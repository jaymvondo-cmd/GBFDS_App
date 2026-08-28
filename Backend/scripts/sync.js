// Creates/updates tables from the Sequelize models — no seed data, no logic.
// Run manually with `npm run db:sync` whenever a model changes.
require("dotenv").config();
const { sequelize } = require("../models");

sequelize
    .sync({ alter: true })
    .then(() => {
        console.log("Database schema synced.");
        return sequelize.close();
    })
    .catch((err) => {
        console.error("Sync failed:", err);
        process.exitCode = 1;
    });
