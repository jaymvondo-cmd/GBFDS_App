const sequelize = require("../config/config");
const { DataTypes } = require("sequelize");

/**
 * A bank account belonging to a customer.
 *
 * This is NOT the same thing as a `user`. A user is a member of staff who
 * logs into Sentinel (an admin or a fraud analyst). An account is a
 * customer's bank account that money moves in and out of.
 *
 * transactions.sender_id and transactions.receiver_id point here.
 */
const Account = sequelize.define(
    "Account",
    {
        account_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        owner_name: {
            type: DataTypes.STRING(100),
        },
        account_type: {
            type: DataTypes.STRING(30),
            defaultValue: "current",
        },
        // When the customer opened the account. The "New Account Large
        // Transfer" rule compares against this: a brand new account moving
        // a lot of money is a classic warning sign.
        opened_at: {
            type: DataTypes.DATE,
        },
        status: {
            type: DataTypes.STRING(20),
            defaultValue: "active",
        },
    },
    {
        tableName: "accounts",
        timestamps: false,
    }
);

module.exports = Account;
