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
    },
    {
        timestamps: true,
    }
);

module.exports = User;
