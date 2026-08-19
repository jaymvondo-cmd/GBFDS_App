const sequelize = require("../config/config");
const { DataTypes } = require("sequelize");

const User = sequelize.define("user", {
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
    },
});

module.exports = User;
