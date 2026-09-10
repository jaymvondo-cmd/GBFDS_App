const { fn, col } = require("sequelize");
const {
    DetectionRule,
    AuditLog,
    Alert,
    Transaction,
    User,
    getAlertThreshold,
    setAlertThreshold,
} = require("../models");
const { logAction } = require("../services/auditLog.service");

const RULE_TYPES = [
    { value: "amount_threshold", label: "Amount threshold" },
    { value: "frequency", label: "Frequency" },
    { value: "graph_pattern", label: "Graph pattern" },
    { value: "account_age", label: "Account age" },
];

/* ------------------------------------------------------------------ */
/* Detection rules                                                     */
/* ------------------------------------------------------------------ */

async function showRules(req, res, next) {
    try {
        const rules = await DetectionRule.findAll({ order: [["created_at", "ASC"]] });
        const threshold = await getAlertThreshold();
        res.render("admin/rules/index", {
            user: req.session.user,
            active: "rules",
            rules,
            threshold,
            ruleTypes: RULE_TYPES,
            success: req.query.success || null,
        });
    } catch (err) {
        next(err);
    }
}

function showRuleForm(req, res) {
    res.render("admin/rules/form", {
        user: req.session.user,
        active: "rules",
        mode: "create",
        error: null,
        ruleTypes: RULE_TYPES,
        values: { is_active: true },
    });
}

async function showRuleEditForm(req, res, next) {
    try {
        const rule = await DetectionRule.findByPk(req.params.id);
        if (!rule) return res.redirect("/admin/rules");
        res.render("admin/rules/form", {
            user: req.session.user,
            active: "rules",
            mode: "edit",
            error: null,
            ruleTypes: RULE_TYPES,
            ruleId: rule.rule_id,
            values: rule.toJSON(),
        });
    } catch (err) {
        next(err);
    }
}

async function createRule(req, res, next) {
    try {
        const { rule_name, description, rule_type, condition_field, threshold, weight } = req.body;

        const renderError = (error) =>
            res.status(400).render("admin/rules/form", {
                user: req.session.user,
                active: "rules",
                mode: "create",
                error,
                ruleTypes: RULE_TYPES,
                values: req.body,
            });

        if (!rule_name || !rule_type || threshold === "" || weight === "") {
            return renderError("Name, type, threshold and weight are all required");
        }
        const weightNum = Number(weight);
        if (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum > 1) {
            return renderError("Weight must be a number between 0 and 1");
        }

        const slug = rule_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

        await DetectionRule.create({
            rule_id: `rule-${slug}-${Date.now()}`,
            rule_name,
            description: description || null,
            rule_type,
            condition_field: condition_field || null,
            threshold: Number(threshold),
            weight: weightNum,
            is_active: true,
            created_by: req.session.user.email,
            created_at: new Date(),
        });

        await logAction(req.session.user.id, "RULE_CREATED", rule_name);
        res.redirect("/admin/rules?success=" + encodeURIComponent(`Rule "${rule_name}" created`));
    } catch (err) {
        next(err);
    }
}

async function updateRule(req, res, next) {
    try {
        const rule = await DetectionRule.findByPk(req.params.id);
        if (!rule) return res.redirect("/admin/rules");

        const { rule_name, description, rule_type, condition_field, threshold, weight } = req.body;
        const weightNum = Number(weight);

        if (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum > 1) {
            return res.status(400).render("admin/rules/form", {
                user: req.session.user,
                active: "rules",
                mode: "edit",
                error: "Weight must be a number between 0 and 1",
                ruleTypes: RULE_TYPES,
                ruleId: rule.rule_id,
                values: req.body,
            });
        }

        rule.rule_name = rule_name;
        rule.description = description || null;
        rule.rule_type = rule_type;
        rule.condition_field = condition_field || null;
        rule.threshold = Number(threshold);
        rule.weight = weightNum;
        await rule.save();

        await logAction(req.session.user.id, "RULE_UPDATED", rule.rule_name);
        res.redirect("/admin/rules?success=" + encodeURIComponent(`Rule "${rule.rule_name}" updated`));
    } catch (err) {
        next(err);
    }
}

async function toggleRule(req, res, next) {
    try {
        const rule = await DetectionRule.findByPk(req.params.id);
        if (!rule) return res.redirect("/admin/rules");

        rule.is_active = !rule.is_active;
        await rule.save();

        await logAction(
            req.session.user.id,
            rule.is_active ? "RULE_ACTIVATED" : "RULE_DEACTIVATED",
            rule.rule_name
        );
        const state = rule.is_active ? "activated" : "deactivated";
        res.redirect("/admin/rules?success=" + encodeURIComponent(`Rule "${rule.rule_name}" ${state}`));
    } catch (err) {
        next(err);
    }
}

async function deleteRule(req, res, next) {
    try {
        const rule = await DetectionRule.findByPk(req.params.id);
        if (rule) {
            await rule.destroy();
            await logAction(req.session.user.id, "RULE_DELETED", rule.rule_name);
        }
        res.redirect("/admin/rules?success=" + encodeURIComponent("Rule deleted"));
    } catch (err) {
        next(err);
    }
}

async function updateThreshold(req, res, next) {
    try {
        const value = Number(req.body.threshold);
        if (!Number.isFinite(value) || value <= 0 || value >= 1) {
            return res.redirect("/admin/rules?success=" + encodeURIComponent("Threshold must be between 0 and 1"));
        }
        await setAlertThreshold(value);
        await logAction(req.session.user.id, "THRESHOLD_UPDATED", `Global alert threshold set to ${value}`);
        res.redirect("/admin/rules?success=" + encodeURIComponent(`Global alert threshold set to ${value}`));
    } catch (err) {
        next(err);
    }
}

/* ------------------------------------------------------------------ */
/* System health & audit                                               */
/* ------------------------------------------------------------------ */

/**
 * showSystemHealth — GET /admin/system
 * The admin's monitoring screen: how much data the system holds, how
 * many alerts are waiting, the risk mix, and the most recent activity.
 */
async function showSystemHealth(req, res, next) {
    try {
        const [totalUsers, totalTransactions, totalAlerts, pendingAlerts, activeRules, totalRules] =
            await Promise.all([
                User.count(),
                Transaction.count(),
                Alert.count(),
                Alert.count({ where: { alert_status: "pending" } }),
                DetectionRule.count({ where: { is_active: true } }),
                DetectionRule.count(),
            ]);

        const classRows = await Transaction.findAll({
            attributes: ["classification", [fn("COUNT", col("transaction_id")), "count"]],
            group: ["classification"],
            raw: true,
        });
        const byClassification = { green: 0, yellow: 0, red: 0 };
        classRows.forEach((r) => {
            byClassification[r.classification] = Number(r.count);
        });

        const alertRows = await Alert.findAll({
            attributes: ["alert_status", [fn("COUNT", col("alert_id")), "count"]],
            group: ["alert_status"],
            raw: true,
        });
        const byAlertStatus = { pending: 0, confirmed: 0, dismissed: 0, escalated: 0 };
        alertRows.forEach((r) => {
            if (byAlertStatus[r.alert_status] !== undefined) byAlertStatus[r.alert_status] = Number(r.count);
        });

        const threshold = await getAlertThreshold();
        const recentActivity = await AuditLog.findAll({ order: [["created_at", "DESC"]], limit: 10 });

        res.render("admin/system", {
            user: req.session.user,
            active: "system",
            stats: {
                totalUsers,
                totalTransactions,
                totalAlerts,
                pendingAlerts,
                activeRules,
                totalRules,
                threshold,
            },
            byClassification,
            byAlertStatus,
            recentActivity,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * showAuditLogs — GET /admin/audit
 * Full activity history, with the acting user's name resolved so the
 * page reads "Admin created a rule" rather than showing a bare id.
 */
async function showAuditLogs(req, res, next) {
    try {
        const logs = await AuditLog.findAll({ order: [["created_at", "DESC"]], limit: 200, raw: true });

        const users = await User.findAll({ attributes: ["id", "name", "prename", "email"], raw: true });
        const usersById = new Map(users.map((u) => [u.id, u]));

        const enriched = logs.map((log) => ({
            ...log,
            actor: usersById.get(log.user_id)
                ? `${usersById.get(log.user_id).prename} ${usersById.get(log.user_id).name}`.trim()
                : log.user_id
                ? `User #${log.user_id}`
                : "System",
        }));

        res.render("admin/audit", {
            user: req.session.user,
            active: "audit",
            logs: enriched,
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    showRules,
    showRuleForm,
    showRuleEditForm,
    createRule,
    updateRule,
    toggleRule,
    deleteRule,
    updateThreshold,
    showSystemHealth,
    showAuditLogs,
};
