const { Op } = require("sequelize");
const { Alert, Transaction } = require("../models");
const { logAction } = require("../services/auditLog.service");

const VALID_STATUSES = ["pending", "confirmed", "dismissed", "escalated"];

/**
 * listAlerts — GET /api/alerts
 *
 * Optional query params:
 *   ?status=pending|confirmed|dismissed|escalated  (filter)
 *   ?search=<text found in the alert_id>            (search)
 *
 * Each alert includes its transaction, since the analyst needs the
 * transaction details (amount, accounts, etc.) alongside the alert.
 */
async function listAlerts(req, res, next) {
    try {
        const { status, search } = req.query;
        const where = {};

        if (status) where.alert_status = status;
        if (search) where.alert_id = { [Op.like]: `%${search}%` };

        const alerts = await Alert.findAll({
            where,
            include: [{ model: Transaction }],
            order: [["created_at", "DESC"]],
        });

        res.json(alerts);
    } catch (err) {
        next(err);
    }
}

/**
 * getAlert — GET /api/alerts/:id
 */
async function getAlert(req, res, next) {
    try {
        const alert = await Alert.findByPk(req.params.id, { include: [{ model: Transaction }] });
        if (!alert) {
            return res.status(404).json({ error: "Alert not found" });
        }
        res.json(alert);
    } catch (err) {
        next(err);
    }
}

/**
 * updateAlert — PUT /api/alerts/:id
 *
 * Handles everything a fraud analyst does to an alert: confirm it as
 * fraud, dismiss it as a false positive, escalate it to a senior
 * compliance officer, and/or leave a comment. Send only the fields
 * that changed — send { alert_status: "confirmed" } to confirm, or
 * { analyst_comment: "..." } to just add a note, or both together.
 *
 * Confirming or dismissing an alert also updates its transaction's
 * status, so the decision is reflected everywhere the transaction
 * shows up.
 */
async function updateAlert(req, res, next) {
    try {
        const alert = await Alert.findByPk(req.params.id);
        if (!alert) {
            return res.status(404).json({ error: "Alert not found" });
        }

        const { alert_status, analyst_comment } = req.body;

        if (alert_status !== undefined) {
            if (!VALID_STATUSES.includes(alert_status)) {
                return res.status(400).json({ error: `alert_status must be one of: ${VALID_STATUSES.join(", ")}` });
            }
            alert.alert_status = alert_status;

            const transaction = await Transaction.findByPk(alert.transaction_id);
            if (transaction) {
                if (alert_status === "confirmed") transaction.transaction_status = "confirmed_fraud";
                if (alert_status === "dismissed") transaction.transaction_status = "legitimate";
                await transaction.save();
            }
        }

        if (analyst_comment !== undefined) {
            alert.analyst_comment = analyst_comment;
        }

        await alert.save();

        const userId = req.user ? req.user.id : null;
        await logAction(userId, "ALERT_UPDATED", `Alert ${alert.alert_id} -> ${alert.alert_status}`);

        res.json(alert);
    } catch (err) {
        next(err);
    }
}

module.exports = { listAlerts, getAlert, updateAlert };
