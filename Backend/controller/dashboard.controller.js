const { Op, fn, col } = require("sequelize");
const { User, Transaction, Alert, sequelize } = require("../models");

const HISTORY_DAYS = 14;

/**
 * showDashboard — GET /dashboard
 *
 * Admins and analysts do different jobs, so they see different
 * dashboards: an admin cares about accounts (who has access), an
 * analyst cares about fraud activity (what needs reviewing). Same
 * route, same nav, different view picked by role.
 */
function showDashboard(req, res) {
    const view = req.session.user.role === "admin" ? "dashboard/admin" : "dashboard/analyst";
    res.render(view, { user: req.session.user, active: "dashboard" });
}

/**
 * getStats — GET /api/dashboard/stats (admin dashboard data)
 * User-account stats: how many users total, split by role, and
 * signups over the last 14 days.
 */
async function getStats(req, res, next) {
    try {
        const totalUsers = await User.count();

        const roleRows = await User.findAll({
            attributes: ["role", [fn("COUNT", col("id")), "count"]],
            group: ["role"],
            raw: true,
        });
        const usersByRole = roleRows.map((row) => ({ role: row.role, count: Number(row.count) }));

        const since = new Date();
        since.setDate(since.getDate() - (HISTORY_DAYS - 1));
        since.setHours(0, 0, 0, 0);

        const signupRows = await User.findAll({
            attributes: [[fn("DATE", col("createdAt")), "date"], [fn("COUNT", col("id")), "count"]],
            where: { createdAt: { [Op.gte]: since } },
            group: [fn("DATE", col("createdAt"))],
            raw: true,
        });

        // Fill every day in the window, including days with zero signups, so
        // the line chart doesn't show a misleading gap.
        const countsByDate = {};
        signupRows.forEach((row) => {
            const key = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10);
            countsByDate[key] = Number(row.count);
        });

        const usersOverTime = [];
        for (let i = 0; i < HISTORY_DAYS; i++) {
            const d = new Date(since);
            d.setDate(d.getDate() + i);
            const key = d.toISOString().slice(0, 10);
            usersOverTime.push({ date: key, count: countsByDate[key] || 0 });
        }

        res.json({ totalUsers, usersByRole, usersOverTime });
    } catch (err) {
        next(err);
    }
}

/**
 * getFraudStats — GET /api/dashboard/fraud-stats (analyst dashboard data)
 * Fraud-activity stats: how many alerts are waiting for review, total
 * transactions seen, the green/yellow/red breakdown, and the most
 * recent pending alerts to jump straight into.
 */
async function getFraudStats(req, res, next) {
    try {
        const activeAlertsCount = await Alert.count({ where: { alert_status: "pending" } });
        const totalTransactions = await Transaction.count();

        const classRows = await Transaction.findAll({
            attributes: ["classification", [fn("COUNT", col("transaction_id")), "count"]],
            group: ["classification"],
            raw: true,
        });
        // Always report all three, even if one has zero transactions,
        // so the chart never silently drops a category.
        const countsByClass = { green: 0, yellow: 0, red: 0 };
        classRows.forEach((row) => {
            countsByClass[row.classification] = Number(row.count);
        });

        const recentAlerts = await Alert.findAll({
            where: { alert_status: "pending" },
            include: [{ model: Transaction }],
            order: [["created_at", "DESC"]],
            limit: 5,
        });

        res.json({
            activeAlertsCount,
            totalTransactions,
            transactionsByClassification: countsByClass,
            recentAlerts,
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { showDashboard, getStats, getFraudStats };
