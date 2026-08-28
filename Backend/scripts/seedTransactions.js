// Seeds realistic sample transaction data so there is something to
// look at in the analyst dashboard, alert list, and transaction graph.
//
// Every transaction here goes through the REAL detection engine (the
// same services/detectionEngine.service.js the live API uses) — risk
// scores, classifications, and alerts are not faked separately, they
// come out exactly as they would from real traffic.
//
// Safe to run more than once: it checks for its own seed data first
// and skips instead of duplicating.
require("dotenv").config();
const { Op } = require("sequelize");
const { sequelize, Transaction, Alert } = require("../models");
const { runDetection } = require("../services/detectionEngine.service");

// A pool of pretend customer account IDs for ORDINARY transactions.
// These are NOT staff logins — transactions.sender_id/receiver_id
// aren't tied to the users table (no foreign key), so any number works
// as an "account".
//
// This pool needs to be large. With too few accounts, random pairings
// quickly connect every account to every other one, and the circular-
// pattern rule (correctly) starts finding loops everywhere — which
// isn't a realistic picture of normal activity. 50 accounts for 18
// random transactions keeps the graph sparse, the way real customer
// traffic would look. The deliberate scenarios below (burst, cycle,
// fraud) use their own separate account IDs so they can't accidentally
// connect into — or get diluted by — this pool.
const ORDINARY_ACCOUNTS = Array.from({ length: 50 }, (_, i) => 2000 + i);
const CITIES = ["Douala", "Yaounde", "Bafoussam", "Garoua", "Bamenda"];
const TYPES = ["transfer", "deposit", "withdrawal", "payment"];

function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function randomAmount(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

/**
 * insertTransaction — saves one transaction and runs the real detection
 * engine on it, exactly like POST /api/transactions does. If it comes
 * back "red", a matching alert is created automatically.
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

    if (classification === "red") {
        await Alert.create({
            alert_id: "ALERT-" + transaction_id.replace("TXN-", ""),
            transaction_id: transaction.transaction_id,
            risk_score: riskScore,
            risk_level: classification,
            reason: triggeredRules.join(", "),
            alert_status: "pending",
            created_at: new Date(),
        });
    }

    return { transaction_id, classification, riskScore, triggeredRules };
}

async function seedTransactions() {
    const existing = await Transaction.count({ where: { transaction_id: { [Op.like]: "TXN-SEED-%" } } });
    if (existing > 0) {
        console.log(`Found ${existing} seed transactions already — skipping (delete them first if you want to reseed).`);
        return [];
    }

    let counter = 1;
    const results = [];
    const now = new Date();

    // 1) Ordinary, low-risk activity spread across the last 14 days —
    // lines up with the web dashboard's "last 14 days" chart.
    for (let i = 0; i < 18; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - Math.floor(Math.random() * 14));
        date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);

        const sender = randomFrom(ORDINARY_ACCOUNTS);
        let receiver = randomFrom(ORDINARY_ACCOUNTS);
        while (receiver === sender) receiver = randomFrom(ORDINARY_ACCOUNTS);

        results.push(
            await insertTransaction({
                transaction_id: `TXN-SEED-${counter++}`,
                sender_id: sender,
                receiver_id: receiver,
                amount: randomAmount(2000, 400000),
                transaction_type: randomFrom(TYPES),
                date_time: date,
                location: randomFrom(CITIES),
            })
        );
    }

    // 2) High-frequency burst: account 1005 pays 5 different accounts
    // within one hour -> triggers the frequency rule (yellow).
    const burstStart = new Date(now);
    burstStart.setDate(burstStart.getDate() - 1);
    burstStart.setHours(9, 0, 0, 0);
    const burstReceivers = [1002, 1003, 1004, 1006, 1007];
    for (let i = 0; i < burstReceivers.length; i++) {
        const t = new Date(burstStart);
        t.setMinutes(t.getMinutes() + i * 5);
        results.push(
            await insertTransaction({
                transaction_id: `TXN-SEED-${counter++}`,
                sender_id: 1005,
                receiver_id: burstReceivers[i],
                amount: randomAmount(5000, 50000),
                transaction_type: "transfer",
                date_time: t,
                location: "Douala",
            })
        );
    }

    // 3) Circular pattern: 1008 -> 1009 -> 1010 -> 1008 (yellow on the
    // closing transaction).
    const cycleStart = new Date(now);
    cycleStart.setDate(cycleStart.getDate() - 2);
    cycleStart.setHours(14, 0, 0, 0);
    const cycleSteps = [
        [1008, 1009],
        [1009, 1010],
        [1010, 1008],
    ];
    for (let i = 0; i < cycleSteps.length; i++) {
        const t = new Date(cycleStart);
        t.setMinutes(t.getMinutes() + i * 10);
        results.push(
            await insertTransaction({
                transaction_id: `TXN-SEED-${counter++}`,
                sender_id: cycleSteps[i][0],
                receiver_id: cycleSteps[i][1],
                amount: randomAmount(20000, 150000),
                transaction_type: "transfer",
                date_time: t,
                location: "Yaounde",
            })
        );
    }

    // 4) A clear fraud case: circular pattern + high frequency stacked
    // on the SAME closing transaction, so the combined score (0.5 + 0.3
    // = 0.8) crosses into "red" and auto-creates a real alert.
    //
    // (Large-amount + circular alone only reaches 0.7, which is still
    // "yellow" per the spec's ">0.7" rule for red — and pairing circular
    // with the new-account rule would need a real, recently-created
    // users row, which would blur the users table's actual purpose:
    // staff logins, not bank customers. Stacking two independent,
    // already-proven signals — circular + frequency — reaches red
    // cleanly without that workaround.)
    const fraudStart = new Date(now);
    fraudStart.setHours(fraudStart.getHours() - 3);

    results.push(
        await insertTransaction({
            transaction_id: `TXN-SEED-${counter++}`,
            sender_id: 1002,
            receiver_id: 1003,
            amount: 30000,
            transaction_type: "transfer",
            date_time: fraudStart,
            location: "Douala",
        })
    );

    const fraudMid = new Date(fraudStart);
    fraudMid.setMinutes(fraudMid.getMinutes() + 10);
    results.push(
        await insertTransaction({
            transaction_id: `TXN-SEED-${counter++}`,
            sender_id: 1003,
            receiver_id: 1004,
            amount: 25000,
            transaction_type: "transfer",
            date_time: fraudMid,
            location: "Douala",
        })
    );

    // 1004 also pays 4 unrelated accounts in quick succession — this
    // alone doesn't trigger anything yet (only 4 distinct receivers).
    const fillerReceivers = [3001, 3002, 3003, 3004];
    for (let i = 0; i < fillerReceivers.length; i++) {
        const t = new Date(fraudMid);
        t.setMinutes(t.getMinutes() + 2 + i * 2);
        results.push(
            await insertTransaction({
                transaction_id: `TXN-SEED-${counter++}`,
                sender_id: 1004,
                receiver_id: fillerReceivers[i],
                amount: randomAmount(5000, 20000),
                transaction_type: "transfer",
                date_time: t,
                location: "Douala",
            })
        );
    }

    // The closing transaction: 1004 -> 1002 is BOTH the 5th distinct
    // receiver from 1004 within the hour (frequency rule) AND the edge
    // that closes the 1002 -> 1003 -> 1004 -> 1002 loop (circular rule).
    const fraudEnd = new Date(fraudMid);
    fraudEnd.setMinutes(fraudEnd.getMinutes() + 12);
    results.push(
        await insertTransaction({
            transaction_id: `TXN-SEED-${counter++}`,
            sender_id: 1004,
            receiver_id: 1002,
            amount: 45000,
            transaction_type: "transfer",
            date_time: fraudEnd,
            location: "Douala",
        })
    );

    return results;
}

seedTransactions()
    .then((results) => {
        if (results.length === 0) return;
        console.log(`Inserted ${results.length} transactions:`);
        results.forEach((r) => {
            const ruleNote = r.triggeredRules.length ? " - " + r.triggeredRules.join(", ") : "";
            console.log(`  ${r.transaction_id}: ${r.classification} (score ${r.riskScore})${ruleNote}`);
        });
    })
    .catch((err) => {
        console.error("Seeding transactions failed:", err);
        process.exitCode = 1;
    })
    .finally(() => sequelize.close());
