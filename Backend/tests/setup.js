/*
 * Test database setup.
 *
 * Tests run against a SEPARATE database (DB_NAME + "_test") so they can
 * create and delete rows freely without ever touching real data. The
 * database is created if it does not exist, and every table is rebuilt
 * from scratch before the tests run.
 */
process.env.NODE_ENV = "test";

const mysql = require("mysql2/promise");

// Point the app at the test database BEFORE anything requires the models,
// because config/config.js reads this when it is first loaded.
const BASE_DB = process.env.DB_NAME || "GBFDS";
const TEST_DB = BASE_DB + "_test";
process.env.DB_NAME = TEST_DB;

async function createTestDatabaseIfMissing() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${TEST_DB}\``);
    await connection.end();
}

module.exports = { createTestDatabaseIfMissing, TEST_DB };
