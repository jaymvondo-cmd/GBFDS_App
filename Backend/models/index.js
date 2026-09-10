const sequelize = require("../config/config");
const User = require("./model.user");
const Account = require("./model.account");
const Transaction = require("./model.transaction");
const Alert = require("./model.alert");
const DetectionRule = require("./model.detectionRule");
const AuditLog = require("./model.auditLog");
const { Setting, getAlertThreshold, setAlertThreshold, DEFAULT_ALERT_THRESHOLD } = require("./model.setting");

module.exports = {
    sequelize,
    User,
    Account,
    Transaction,
    Alert,
    DetectionRule,
    AuditLog,
    Setting,
    getAlertThreshold,
    setAlertThreshold,
    DEFAULT_ALERT_THRESHOLD,
};
