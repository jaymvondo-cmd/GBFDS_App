const sequelize = require("../config/config");
const { DataTypes } = require("sequelize");
const Transaction = require("./model.transaction");

// Schema as specified — no business logic here, just the table shape.
const Alert = sequelize.define(
    "Alert",
    {
        alert_id: {
            type: DataTypes.STRING(50),
            primaryKey: true,
        },
        transaction_id: {
            type: DataTypes.STRING(50),
            references: {
                model: Transaction,
                key: "transaction_id",
            },
        },
        risk_score: {
            type: DataTypes.DOUBLE,
        },
        risk_level: {
            type: DataTypes.STRING(10),
        },
        reason: {
            type: DataTypes.TEXT,
        },
        alert_status: {
            type: DataTypes.STRING(20),
            defaultValue: "pending",
        },
        created_at: {
            type: DataTypes.DATE,
        },
        analyst_comment: {
            type: DataTypes.TEXT,
        },
    },
    {
        tableName: "alerts",
        timestamps: false,
    }
);

Alert.belongsTo(Transaction, { foreignKey: "transaction_id", targetKey: "transaction_id" });
Transaction.hasMany(Alert, { foreignKey: "transaction_id", sourceKey: "transaction_id" });

module.exports = Alert;
