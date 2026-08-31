const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: "mysql",
        // Printing every SQL statement is handy while developing, but it
        // buries the actual results when the tests run.
        logging: process.env.NODE_ENV === "test" ? false : console.log,
    }
);

module.exports = sequelize;
