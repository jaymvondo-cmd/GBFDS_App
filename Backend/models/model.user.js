const sequelize = require("../config/config");
const { DataTypes } = require("sequelize");

const User = sequelize.define(
    "user",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING,
        },
        prename: {
            type: DataTypes.STRING,
        },
        telephone: {
            type: DataTypes.STRING,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true,
            },
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        role: {
            type: DataTypes.ENUM("admin", "analyst"),
            allowNull: false,
            defaultValue: "analyst",
        },
        // When this account last signed in.
        last_login_at: {
            type: DataTypes.DATE,
        },
        // When this account last made any request. Updated at most once
        // a minute (see auth.middleware.js) so it costs almost nothing,
        // and it is what "currently online" is judged on — a session
        // cookie lasts a day, so its mere existence would wrongly show
        // someone as online long after they closed the browser.
        last_seen_at: {
            type: DataTypes.DATE,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = User;
