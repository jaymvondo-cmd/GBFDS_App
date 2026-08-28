const { fn, col } = require("sequelize");
const { AuditLog, Alert, Transaction, User } = require("../models");

/**
 * getAuditLogs — GET /api/audit-logs
 * The 200 most recent logged actions, newest first.
 */
async function getAuditLogs(req, res, next) {
    try {
        const logs = await AuditLog.findAll({
            order: [["created_at", "DESC"]],
            limit: 200,
        });
        res.json(logs);
    } catch (err) {
        next(err);
    }
}

/**
 * getHealth — GET /api/health
 *
 * A quick snapshot for the System Admin's monitoring screen: how many
 * alerts are still waiting for review, and how transactions break down
 * by traffic-light classification (green/yellow/red) — i.e. the fraud
 * detection statistics.
 */
async function getHealth(req, res, next) {
    try {
        const activeAlertsCount = await Alert.count({ where: { alert_status: "pending" } });
        const totalTransactions = await Transaction.count();
        const totalUsers = await User.count();

        const byClassification = await Transaction.findAll({
            attributes: ["classification", [fn("COUNT", col("transaction_id")), "count"]],
            group: ["classification"],
            raw: true,
        });

        res.json({
            status: "ok",
            activeAlertsCount,
            totalTransactions,
            totalUsers,
            transactionsByClassification: byClassification,
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { getAuditLogs, getHealth };
