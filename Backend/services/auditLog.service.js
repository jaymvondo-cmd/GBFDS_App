const { AuditLog } = require("../models");

/**
 * logAction — writes one row to the audit_logs table.
 *
 * Call this after anything worth remembering: a login, a rule being
 * created or changed, an alert being confirmed/dismissed, a user account
 * being created/edited/deleted. It never throws — a logging failure
 * should never break the real action that triggered it, so any DB error
 * here is just printed to the console instead of stopping the request.
 *
 * @param {number|null} userId - who did it (null if unknown/system)
 * @param {string} action - short label, e.g. "LOGIN", "RULE_CREATED"
 * @param {string} [details] - free-text extra context
 */
async function logAction(userId, action, details) {
    try {
        await AuditLog.create({
            user_id: userId,
            action,
            details: details || null,
            created_at: new Date(),
        });
    } catch (err) {
        console.error("Failed to write audit log:", err.message);
    }
}

module.exports = { logAction };
