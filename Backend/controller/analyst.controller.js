const { Op } = require("sequelize");
const { Alert, Transaction } = require("../models");
const { getGraphData } = require("../services/graph.service");
const { logAction } = require("../services/auditLog.service");

const ALERT_STATUSES = ["pending", "confirmed", "dismissed", "escalated"];

/**
 * showAlerts — GET /alerts
 * The analyst's main working list. Supports filtering by status and
 * searching by alert ID, both taken from the query string so a filtered
 * view can be bookmarked or shared.
 */
async function showAlerts(req, res, next) {
    try {
        const { status, search } = req.query;
        const where = {};
        if (status && ALERT_STATUSES.includes(status)) where.alert_status = status;
        if (search) where.alert_id = { [Op.like]: `%${search}%` };

        const alerts = await Alert.findAll({
            where,
            include: [{ model: Transaction }],
            order: [["created_at", "DESC"]],
        });

        // Counts for the filter tabs — always the totals, not the
        // filtered set, so the tabs don't change as you click through.
        const allAlerts = await Alert.findAll({ attributes: ["alert_status"], raw: true });
        const counts = { all: allAlerts.length, pending: 0, confirmed: 0, dismissed: 0, escalated: 0 };
        allAlerts.forEach((a) => {
            if (counts[a.alert_status] !== undefined) counts[a.alert_status] += 1;
        });

        res.render("analyst/alerts", {
            user: req.session.user,
            active: "alerts",
            alerts,
            counts,
            currentStatus: status || "all",
            search: search || "",
            success: req.query.success || null,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * showAlertDetail — GET /alerts/:id
 * Everything about one alert: the transaction behind it, the risk score,
 * which rules fired, and the other transactions involving the same two
 * accounts so the analyst can see the pattern in context.
 */
async function showAlertDetail(req, res, next) {
    try {
        const alert = await Alert.findByPk(req.params.id, { include: [{ model: Transaction }] });
        if (!alert) return res.redirect("/alerts");

        const tx = alert.Transaction;
        let relatedTransactions = [];
        if (tx) {
            relatedTransactions = await Transaction.findAll({
                where: {
                    transaction_id: { [Op.ne]: tx.transaction_id },
                    [Op.or]: [
                        { sender_id: { [Op.in]: [tx.sender_id, tx.receiver_id] } },
                        { receiver_id: { [Op.in]: [tx.sender_id, tx.receiver_id] } },
                    ],
                },
                order: [["date_time", "DESC"]],
                limit: 10,
            });
        }

        res.render("analyst/alert-detail", {
            user: req.session.user,
            active: "alerts",
            alert,
            transaction: tx,
            relatedTransactions,
            reasons: alert.reason ? alert.reason.split(", ") : [],
        });
    } catch (err) {
        next(err);
    }
}

/**
 * updateAlert — POST /alerts/:id
 * Handles all four analyst decisions in one place: confirm as fraud,
 * dismiss as a false positive, escalate to a senior compliance officer,
 * or just save a comment. Confirming/dismissing also updates the
 * underlying transaction so the decision shows everywhere.
 */
async function updateAlert(req, res, next) {
    try {
        const alert = await Alert.findByPk(req.params.id);
        if (!alert) return res.redirect("/alerts");

        const { action, analyst_comment } = req.body;

        if (analyst_comment !== undefined) {
            alert.analyst_comment = analyst_comment;
        }

        let message = "Comment saved";
        if (action && action !== "comment") {
            if (!ALERT_STATUSES.includes(action)) {
                return res.redirect(`/alerts/${alert.alert_id}`);
            }
            alert.alert_status = action;
            message = `Alert marked as ${action}`;

            const transaction = await Transaction.findByPk(alert.transaction_id);
            if (transaction) {
                if (action === "confirmed") transaction.transaction_status = "confirmed_fraud";
                if (action === "dismissed") transaction.transaction_status = "legitimate";
                if (action === "escalated") transaction.transaction_status = "escalated";
                await transaction.save();
            }
        }

        await alert.save();
        await logAction(req.session.user.id, "ALERT_UPDATED", `${alert.alert_id} -> ${alert.alert_status}`);

        res.redirect("/alerts?success=" + encodeURIComponent(message));
    } catch (err) {
        next(err);
    }
}

/**
 * showTransactions — GET /transactions
 * Full transaction list with the filters the spec asks for: date range,
 * amount range, account ID, and risk classification.
 */
async function showTransactions(req, res, next) {
    try {
        const { dateFrom, dateTo, minAmount, maxAmount, accountId, classification } = req.query;
        const where = {};

        if (dateFrom || dateTo) {
            where.date_time = {};
            if (dateFrom) where.date_time[Op.gte] = new Date(dateFrom);
            if (dateTo) where.date_time[Op.lte] = new Date(dateTo + "T23:59:59");
        }
        if (minAmount) where.amount = { ...(where.amount || {}), [Op.gte]: Number(minAmount) };
        if (maxAmount) where.amount = { ...(where.amount || {}), [Op.lte]: Number(maxAmount) };
        if (classification) where.classification = classification;
        if (accountId) {
            const id = Number(accountId);
            where[Op.or] = [{ sender_id: id }, { receiver_id: id }];
        }

        const transactions = await Transaction.findAll({
            where,
            order: [["date_time", "DESC"]],
            limit: 300,
        });

        res.render("analyst/transactions", {
            user: req.session.user,
            active: "transactions",
            transactions,
            filters: { dateFrom, dateTo, minAmount, maxAmount, accountId, classification },
        });
    } catch (err) {
        next(err);
    }
}

/**
 * showTransactionDetail — GET /transactions/:id
 */
async function showTransactionDetail(req, res, next) {
    try {
        const transaction = await Transaction.findByPk(req.params.id);
        if (!transaction) return res.redirect("/transactions");

        const alerts = await Alert.findAll({ where: { transaction_id: transaction.transaction_id } });

        res.render("analyst/transaction-detail", {
            user: req.session.user,
            active: "transactions",
            transaction,
            alerts,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * showGraph — GET /graph
 * The money-flow map page. The page itself is just the shell; the actual
 * node/edge data is fetched by the browser from /api/graph below.
 */
function showGraph(req, res) {
    res.render("analyst/graph", {
        user: req.session.user,
        active: "graph",
        filters: req.query,
    });
}

/**
 * getGraphJson — GET /api/graph
 * Node/edge/cycle data for the money-flow map, honouring the same
 * filters as the transactions list.
 */
async function getGraphJson(req, res, next) {
    try {
        const data = await getGraphData(req.query);
        res.json(data);
    } catch (err) {
        next(err);
    }
}

/**
 * getAccountJson — GET /api/accounts/:id
 * Details for one account, shown when an analyst clicks a node on the map.
 */
async function getAccountJson(req, res, next) {
    try {
        const id = Number(req.params.id);

        const sent = await Transaction.findAll({ where: { sender_id: id }, raw: true });
        const received = await Transaction.findAll({ where: { receiver_id: id }, raw: true });

        const sum = (list) => list.reduce((total, t) => total + Number(t.amount), 0);
        const recent = [...sent, ...received]
            .sort((a, b) => new Date(b.date_time) - new Date(a.date_time))
            .slice(0, 8);

        res.json({
            accountId: id,
            sentCount: sent.length,
            receivedCount: received.length,
            totalSent: sum(sent),
            totalReceived: sum(received),
            flaggedCount: [...sent, ...received].filter((t) => t.classification !== "green").length,
            recentTransactions: recent,
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    showAlerts,
    showAlertDetail,
    updateAlert,
    showTransactions,
    showTransactionDetail,
    showGraph,
    getGraphJson,
    getAccountJson,
};
