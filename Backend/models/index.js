const sequelize = require("../config/config");
const User = require("./model.user");
const Transaction = require("./model.transaction");
const Alert = require("./model.alert");
const DetectionRule = require("./model.detectionRule");
const AuditLog = require("./model.auditLog");

module.exports = {
    sequelize,
    User,
    Transaction,
    Alert,
    DetectionRule,
    AuditLog,
};
