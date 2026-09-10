// Adds 15 more RED transactions and 5 YELLOW alerts on top of whatever
// seedTransactions.js already put in the database. Written as its own
// script (rather than editing seedTransactions.js) so it can be run
// again on top of an existing, already-demoed database without
// disturbing anything already there.
//
// Safe to run more than once: it checks for its own TXN-RED-*/TXN-YEL-*
// rows first and skips instead of duplicating.
require("dotenv").config();
const { Op } = require("sequelize");
const { sequelize, Transaction, Account, Alert } = require("../models");
const { runDetection } = require("../services/detectionEngine.service");

const CITIES = ["Douala", "Yaounde", "Bafoussam", "Garoua", "Bamenda"];

function randomAmount(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

/**
 * insertTransaction — same pattern as seedTransactions.js: save the
 * transaction, run the REAL detection engine on it, and auto-create an
 * alert if (and only if) it comes back red. That is the live app's
 * actual rule (see transaction.controller.js) — nothing here fakes a
 * score or bypasses it.
 */
async function insertTransaction({ transaction_id, sender_id, receiver_id, amount, transaction_type, date_time, location }) {
    const transaction = await Transaction.create({
        transaction_id,
        sender_id,
        receiver_id,
        amount,
        transaction_type,
        date_time,
        location,
    });

    const { riskScore, classification, triggeredRules } = await runDetection(transaction);
    transaction.risk_score = riskScore;
    transaction.classification = classification;
    await transaction.save();

    let alert = null;
    if (classification === "red") {
        alert = await Alert.create({
            alert_id: "ALERT-" + transaction_id.replace("TXN-", ""),
            transaction_id: transaction.transaction_id,
            risk_score: riskScore,
            risk_level: classification,
            reason: triggeredRules.join(", "),
            alert_status: "pending",
            created_at: new Date(),
        });
    }

    return { transaction_id, classification, riskScore, triggeredRules, alert };
}

/**
 * makeRedCase — a small, self-contained 3-account ring: A pays B, B
 * pays C, then C pays back to A. C is a customer account opened only a
 * couple of hours before that closing payment.
 *
 * The closing transaction (C -> A) trips TWO rules at once:
 *   - Circular Transaction Pattern (0.5) — it closes the A->B->C loop.
 *   - New Account Large Transfer  (0.4) — C is brand new and the amount
 *     is above the rule's 500,000 threshold.
 * 0.5 + 0.4 = 0.9, comfortably over the 0.7 red line — a real red
 * classification from the real engine, not a hand-set score.
 *
 * Each case uses its own private trio of account IDs so the 15 rings
 * can never accidentally connect to each other or to the rest of the
 * seed data (same reasoning as the isolated pools in seedTransactions.js).
 */
async function makeRedCase(index, results) {
    const base = 6000 + index * 3;
    const accountA = base;
    const accountB = base + 1;
    const accountC = base + 2; // the "new" account that closes the loop

    const now = new Date();
    const closingTime = new Date(now);
    closingTime.setDate(closingTime.getDate() - Math.floor(Math.random() * 10)); // spread across the last 10 days
    closingTime.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);

    const openedRecently = new Date(closingTime.getTime() - (1 + Math.random() * 20) * 60 * 60 * 1000); // 1-21h before closing
    const openedLongAgo = new Date(closingTime.getTime() - 200 * 24 * 60 * 60 * 1000); // ~200 days before

    await Account.bulkCreate([
        { account_id: accountA, owner_name: `Ring ${index + 1} - Account A`, opened_at: openedLongAgo, status: "active" },
        { account_id: accountB, owner_name: `Ring ${index + 1} - Account B`, opened_at: openedLongAgo, status: "active" },
        { account_id: accountC, owner_name: `Ring ${index + 1} - Account C (new)`, opened_at: openedRecently, status: "active" },
    ]);

    const hopTime = (minutesBefore) => new Date(closingTime.getTime() - minutesBefore * 60 * 1000);

    results.push(
        await insertTransaction({
            transaction_id: `TXN-RED-${index + 1}a`,
            sender_id: accountA,
            receiver_id: accountB,
            amount: randomAmount(15000, 60000),
            transaction_type: "transfer",
            date_time: hopTime(20),
            location: CITIES[index % CITIES.length],
        })
    );

    results.push(
        await insertTransaction({
            transaction_id: `TXN-RED-${index + 1}b`,
            sender_id: accountB,
            receiver_id: accountC,
            amount: randomAmount(15000, 60000),
            transaction_type: "transfer",
            date_time: hopTime(10),
            location: CITIES[index % CITIES.length],
        })
    );

    results.push(
        await insertTransaction({
            transaction_id: `TXN-RED-${index + 1}`,
            sender_id: accountC,
            receiver_id: accountA,
            amount: randomAmount(520000, 980000), // > the 500,000 new-account threshold
            transaction_type: "transfer",
            date_time: closingTime,
            location: CITIES[index % CITIES.length],
        })
    );
}

/**
 * makeYellowCase — one customer account, opened within the last day,
 * sends a single large-ish transfer. Only the New Account Large
 * Transfer rule fires (weight 0.4), which lands squarely in "yellow"
 * (0.3-0.7) from the real engine.
 *
 * The live app only auto-creates an Alert for a RED transaction (see
 * transaction.controller.js) — that rule is left exactly as-is. These 5
 * yellow alerts are created explicitly, right here, as sample
 * lower-priority review items for the demo. If asked: "the engine only
 * auto-alerts on red; these were added by hand to show what a yellow
 * item looks like in the queue."
 */
async function makeYellowCase(index, results) {
    const senderAccount = 7000 + index;
    const receiverAccount = 8000 + index;

    const now = new Date();
    const txTime = new Date(now);
    txTime.setDate(txTime.getDate() - Math.floor(Math.random() * 6));
    txTime.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);

    const openedRecently = new Date(txTime.getTime() - (2 + Math.random() * 18) * 60 * 60 * 1000); // 2-20h before

    await Account.bulkCreate([
        { account_id: senderAccount, owner_name: `Yellow case ${index + 1} - sender (new)`, opened_at: openedRecently, status: "active" },
        { account_id: receiverAccount, owner_name: `Yellow case ${index + 1} - receiver`, opened_at: new Date(txTime.getTime() - 200 * 24 * 60 * 60 * 1000), status: "active" },
    ]);

    const { transaction_id, classification, riskScore, triggeredRules } = await insertTransaction({
        transaction_id: `TXN-YEL-${index + 1}`,
        sender_id: senderAccount,
        receiver_id: receiverAccount,
        amount: randomAmount(600000, 900000), // > 500,000 new-account threshold, < 1,000,000 large-amount threshold
        transaction_type: "transfer",
        date_time: txTime,
        location: CITIES[index % CITIES.length],
    });

    if (classification !== "yellow") {
        console.warn(`  ! ${transaction_id} came back "${classification}", not yellow as expected — skipping its alert.`);
        results.push({ transaction_id, classification, riskScore, triggeredRules, alert: null });
        return;
    }

    const alert = await Alert.create({
        alert_id: `ALERT-YEL-${index + 1}`,
        transaction_id,
        risk_score: riskScore,
        risk_level: "yellow",
        reason: triggeredRules.join(", "),
        alert_status: "pending",
        created_at: new Date(),
    });

    results.push({ transaction_id, classification, riskScore, triggeredRules, alert });
}

async function seedMoreAlerts() {
    const existingRed = await Transaction.count({ where: { transaction_id: { [Op.like]: "TXN-RED-%" } } });
    const existingYellow = await Transaction.count({ where: { transaction_id: { [Op.like]: "TXN-YEL-%" } } });
    if (existingRed > 0 || existingYellow > 0) {
        console.log("Found TXN-RED-*/TXN-YEL-* rows already — skipping (delete them first if you want to reseed).");
        return [];
    }

    const results = [];

    for (let i = 0; i < 15; i++) {
        await makeRedCase(i, results);
    }

    for (let j = 0; j < 5; j++) {
        await makeYellowCase(j, results);
    }

    return results;
}

seedMoreAlerts()
    .then((results) => {
        if (results.length === 0) return;
        const redAlerts = results.filter((r) => r.alert && r.alert.risk_level === "red").length;
        const yellowAlerts = results.filter((r) => r.alert && r.alert.risk_level === "yellow").length;
        console.log(`Inserted ${results.length} transactions:`);
        results.forEach((r) => {
            const ruleNote = r.triggeredRules.length ? " - " + r.triggeredRules.join(", ") : "";
            const alertNote = r.alert ? ` [alert ${r.alert.alert_id}]` : "";
            console.log(`  ${r.transaction_id}: ${r.classification} (score ${r.riskScore})${ruleNote}${alertNote}`);
        });
        console.log(`\n${redAlerts} red alerts and ${yellowAlerts} yellow alerts created.`);
    })
    .catch((err) => {
        console.error("Seeding failed:", err);
        process.exitCode = 1;
    })
    .finally(() => sequelize.close());
