const sequelize = require("../config/config");
const { DataTypes } = require("sequelize");

// Schema as specified — no business logic here, just the table shape.
const Transaction = sequelize.define(
    "Transaction",
    {
        transaction_id: {
            type: DataTypes.STRING(50),
            primaryKey: true,
        },
        sender_id: {
            type: DataTypes.INTEGER,
        },
        receiver_id: {
            type: DataTypes.INTEGER,
        },
        amount: {
            type: DataTypes.DECIMAL(15, 2),
        },
        transaction_type: {
            type: DataTypes.STRING(50),
        },
        date_time: {
            type: DataTypes.DATE,
        },
        location: {
            type: DataTypes.STRING(100),
        },
        risk_score: {
            type: DataTypes.DOUBLE,
            defaultValue: 0,
        },
        transaction_status: {
            type: DataTypes.STRING(20),
            defaultValue: "pending",
        },
        classification: {
            type: DataTypes.STRING(10),
            defaultValue: "green",
        },
    },
    {
        tableName: "transactions",
        timestamps: false,
    }
);

module.exports = Transaction;
