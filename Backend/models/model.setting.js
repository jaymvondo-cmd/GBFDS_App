const sequelize = require("../config/config");
const { DataTypes } = require("sequelize");

// Simple key/value store for system-wide settings the admin can change
// from the UI — currently the global alert threshold (default 0.7).
const Setting = sequelize.define(
    "Setting",
    {
        setting_key: {
            type: DataTypes.STRING(50),
            primaryKey: true,
        },
        setting_value: {
            type: DataTypes.STRING(255),
        },
        updated_at: {
            type: DataTypes.DATE,
        },
    },
    {
        tableName: "settings",
        timestamps: false,
    }
);

const ALERT_THRESHOLD_KEY = "alert_threshold";
const DEFAULT_ALERT_THRESHOLD = 0.7;

/**
 * getAlertThreshold — the score above which a transaction becomes a red
 * fraud alert. Falls back to 0.7 if the admin has never changed it.
 */
async function getAlertThreshold() {
    const row = await Setting.findByPk(ALERT_THRESHOLD_KEY);
    if (!row) return DEFAULT_ALERT_THRESHOLD;
    const value = Number(row.setting_value);
    return Number.isFinite(value) ? value : DEFAULT_ALERT_THRESHOLD;
}

async function setAlertThreshold(value) {
    await Setting.upsert({
        setting_key: ALERT_THRESHOLD_KEY,
        setting_value: String(value),
        updated_at: new Date(),
    });
}

module.exports = { Setting, getAlertThreshold, setAlertThreshold, DEFAULT_ALERT_THRESHOLD };
