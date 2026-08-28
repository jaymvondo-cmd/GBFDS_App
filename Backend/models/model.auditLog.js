const sequelize = require("../config/config");
const { DataTypes } = require("sequelize");

// A simple activity log: who did what, and when.
// Not in the original spec's table list (only GET /api/audit-logs was
// mentioned) — added because the endpoint needs somewhere to read from.
const AuditLog = sequelize.define(
    "AuditLog",
    {
        log_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
        },
        action: {
            type: DataTypes.STRING(100),
        },
        details: {
            type: DataTypes.TEXT,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        tableName: "audit_logs",
        timestamps: false,
    }
);

module.exports = AuditLog;
