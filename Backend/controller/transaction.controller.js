const crypto = require("crypto");
const { Transaction, Alert } = require("../models");
const { runDetection } = require("../services/detectionEngine.service");
const { logAction } = require("../services/auditLog.service");

/**
 * createTransaction — POST /api/transactions
 *
 * Saves a new transaction, then immediately runs the fraud detection
 * engine on it (see services/detectionEngine.service.js). The
 * transaction's risk_score and classification are updated with the
 * result. If the classification comes back "red", an alert is created
 * automatically for a fraud analyst to review — that alert appearing in
 * GET /api/alerts IS the notification the analyst sees.
 *
 * transaction_id isn't sent by the caller — the server generates one,
 * so two transactions can never collide on the same ID.
 */
async function createTransaction(req, res, next) {
    try {
        const { sender_id, receiver_id, amount, transaction_type, date_time, location } = req.body;

        if (!sender_id || !receiver_id || amount === undefined || !transaction_type || !date_time) {
            return res.status(400).json({
                error: "sender_id, receiver_id, amount, transaction_type, and date_time are required",
            });
        }

        const transaction = await Transaction.create({
            transaction_id: "TXN-" + crypto.randomUUID(),
            sender_id,
            receiver_id,
            amount,
            transaction_type,
            date_time,
            location: location || null,
        });

        const { riskScore, classification, triggeredRules } = await runDetection(transaction);

        transaction.risk_score = riskScore;
        transaction.classification = classification;
        await transaction.save();

        let alert = null;
        if (classification === "red") {
            alert = await Alert.create({
                alert_id: "ALERT-" + crypto.randomUUID(),
                transaction_id: transaction.transaction_id,
                risk_score: riskScore,
                risk_level: classification,
                reason: triggeredRules.join(", "),
                alert_status: "pending",
                created_at: new Date(),
            });
            await logAction(null, "ALERT_CREATED", `Alert ${alert.alert_id} auto-created for transaction ${transaction.transaction_id}`);
        }

        res.status(201).json({ transaction, alert, triggeredRules });
    } catch (err) {
        next(err);
    }
}

/**
 * listTransactions — GET /api/transactions
 * Newest first.
 */
async function listTransactions(req, res, next) {
    try {
        const transactions = await Transaction.findAll({ order: [["date_time", "DESC"]] });
        res.json(transactions);
    } catch (err) {
        next(err);
    }
}

/**
 * getTransaction — GET /api/transactions/:id
 */
async function getTransaction(req, res, next) {
    try {
        const transaction = await Transaction.findByPk(req.params.id);
        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }
        res.json(transaction);
    } catch (err) {
        next(err);
    }
}

/**
 * detectTransaction — POST /api/detect
 *
 * Re-runs the detection engine on a transaction that already exists
 * (send { transaction_id }). Useful for testing the engine directly in
 * Postman, or re-checking a transaction after the rules change.
 */
async function detectTransaction(req, res, next) {
    try {
        const { transaction_id } = req.body;
        if (!transaction_id) {
            return res.status(400).json({ error: "transaction_id is required" });
        }

        const transaction = await Transaction.findByPk(transaction_id);
        if (!transaction) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        const { riskScore, classification, triggeredRules } = await runDetection(transaction);

        transaction.risk_score = riskScore;
        transaction.classification = classification;
        await transaction.save();

        res.json({ transaction, triggeredRules });
    } catch (err) {
        next(err);
    }
}

module.exports = { createTransaction, listTransactions, getTransaction, detectTransaction };
