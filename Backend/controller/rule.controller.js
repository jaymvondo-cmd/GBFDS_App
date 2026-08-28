const { DetectionRule } = require("../models");
const { logAction } = require("../services/auditLog.service");

/**
 * listRules — GET /api/rules
 */
async function listRules(req, res, next) {
    try {
        const rules = await DetectionRule.findAll({ order: [["created_at", "DESC"]] });
        res.json(rules);
    } catch (err) {
        next(err);
    }
}

/**
 * createRule — POST /api/rules
 * Send { rule_name, description, rule_type, condition_field,
 * threshold, weight }. The rule_id is generated from the name so the
 * admin never has to invent one.
 */
async function createRule(req, res, next) {
    try {
        const { rule_name, description, rule_type, condition_field, threshold, weight } = req.body;

        if (!rule_name || !rule_type || threshold === undefined || weight === undefined) {
            return res.status(400).json({ error: "rule_name, rule_type, threshold, and weight are required" });
        }

        const slug = rule_name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
        const rule_id = `rule-${slug}-${Date.now()}`;

        const rule = await DetectionRule.create({
            rule_id,
            rule_name,
            description: description || null,
            rule_type,
            condition_field: condition_field || null,
            threshold,
            weight,
            is_active: true,
            created_by: req.user.email,
            created_at: new Date(),
        });

        await logAction(req.user.id, "RULE_CREATED", `Created rule ${rule.rule_id}`);
        res.status(201).json(rule);
    } catch (err) {
        next(err);
    }
}

/**
 * updateRule — PUT /api/rules/:id
 * Also how a rule gets activated/deactivated — send { is_active: false }.
 */
async function updateRule(req, res, next) {
    try {
        const rule = await DetectionRule.findByPk(req.params.id);
        if (!rule) {
            return res.status(404).json({ error: "Rule not found" });
        }

        const { rule_name, description, rule_type, condition_field, threshold, weight, is_active } = req.body;

        if (rule_name !== undefined) rule.rule_name = rule_name;
        if (description !== undefined) rule.description = description;
        if (rule_type !== undefined) rule.rule_type = rule_type;
        if (condition_field !== undefined) rule.condition_field = condition_field;
        if (threshold !== undefined) rule.threshold = threshold;
        if (weight !== undefined) rule.weight = weight;
        if (is_active !== undefined) rule.is_active = is_active;

        await rule.save();
        await logAction(req.user.id, "RULE_UPDATED", `Updated rule ${rule.rule_id}`);

        res.json(rule);
    } catch (err) {
        next(err);
    }
}

/**
 * deleteRule — DELETE /api/rules/:id
 */
async function deleteRule(req, res, next) {
    try {
        const rule = await DetectionRule.findByPk(req.params.id);
        if (!rule) {
            return res.status(404).json({ error: "Rule not found" });
        }

        await rule.destroy();
        await logAction(req.user.id, "RULE_DELETED", `Deleted rule ${rule.rule_id}`);

        res.json({ message: "Rule deleted" });
    } catch (err) {
        next(err);
    }
}

module.exports = { listRules, createRule, updateRule, deleteRule };
