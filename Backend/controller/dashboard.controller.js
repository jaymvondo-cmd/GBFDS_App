const { Op, fn, col } = require("sequelize");
const { User, sequelize } = require("../models");

const HISTORY_DAYS = 14;

function showDashboard(req, res) {
    res.render("dashboard/index", { user: req.session.user, active: "dashboard" });
}

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

module.exports = { showDashboard, getStats };
