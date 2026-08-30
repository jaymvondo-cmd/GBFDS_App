const { User, AuditLog, Alert } = require("../models");

/**
 * showProfile — GET /profile
 *
 * The signed-in person's own account page: who they are, what access
 * they have, and what they have recently done in the system. Available
 * to both roles — everyone can see their own profile.
 */
async function showProfile(req, res, next) {
    try {
        const account = await User.findByPk(req.session.user.id, {
            attributes: { exclude: ["password"] },
        });

        if (!account) {
            return req.session.destroy(() => res.redirect("/login"));
        }

        const recentActivity = await AuditLog.findAll({
            where: { user_id: account.id },
            order: [["created_at", "DESC"]],
            limit: 15,
            raw: true,
        });

        // A small sense of workload for an analyst: how many alerts are
        // still waiting for someone to look at them.
        const pendingAlerts = await Alert.count({ where: { alert_status: "pending" } });

        res.render("profile", {
            user: req.session.user,
            active: "profile",
            account,
            recentActivity,
            pendingAlerts,
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { showProfile };
