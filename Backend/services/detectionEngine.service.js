const { Op } = require("sequelize");
const Graph = require("graphology");
const { allSimplePaths } = require("graphology-simple-path");
const { Transaction, DetectionRule, Account, getAlertThreshold } = require("../models");

// "Account" isn't a separate table in this database — sender_id and
// receiver_id are both users.id. So "an account's age" below means
// "how long ago that user row was created".

/**
 * buildTransactionGraph — builds a directed graph from every
 * transaction already saved in the database.
 *
 * Each account (sender or receiver) becomes a node. Each transaction
 * becomes an edge pointing from sender to receiver. This graph is what
 * the circular-pattern rule searches for closed loops in.
 */
async function buildTransactionGraph() {
    const graph = new Graph({ type: "directed" });
    const transactions = await Transaction.findAll({ raw: true });

    transactions.forEach((tx) => {
        if (!graph.hasNode(tx.sender_id)) graph.addNode(tx.sender_id);
        if (!graph.hasNode(tx.receiver_id)) graph.addNode(tx.receiver_id);
        if (!graph.hasEdge(tx.sender_id, tx.receiver_id)) {
            graph.addEdge(tx.sender_id, tx.receiver_id);
        }
    });

    return graph;
}

/**
 * checkCircularPattern — Rule 1: Circular Transaction Pattern.
 *
 * A new transaction sender -> receiver closes a loop if there is
 * already a path leading from the receiver back to the sender. That
 * existing path plus the new transaction together form a cycle.
 *
 * minAccounts is how many accounts must be in that cycle for it to
 * count (the rule's threshold, default 3 — e.g. A pays B, B pays C,
 * C pays back to A).
 */
function checkCircularPattern(graph, senderId, receiverId, minAccounts) {
    if (!graph.hasNode(senderId) || !graph.hasNode(receiverId)) {
        return false;
    }

    const pathsBackToSender = allSimplePaths(graph, receiverId, senderId);

    // Each path already lists every account in the loop (receiver ...
    // sender), so its length IS the number of accounts in the cycle.
    return pathsBackToSender.some((path) => path.length >= minAccounts);
}

/**
 * checkHighFrequency — Rule 2: High Frequency Transfers.
 *
 * True if this sender has sent money to `minReceivers` or more
 * different accounts within the 1 hour leading up to this transaction.
 */
async function checkHighFrequency(senderId, dateTime, minReceivers) {
    const oneHourBefore = new Date(new Date(dateTime).getTime() - 60 * 60 * 1000);

    const recentTransactions = await Transaction.findAll({
        where: {
            sender_id: senderId,
            date_time: { [Op.between]: [oneHourBefore, dateTime] },
        },
        raw: true,
    });

    const distinctReceivers = new Set(recentTransactions.map((t) => t.receiver_id));
    return distinctReceivers.size >= minReceivers;
}

/**
 * checkLargeAmount — Rule 3: Large Amount Transfer.
 *
 * True if the transaction amount is over the rule's threshold.
 */
function checkLargeAmount(amount, threshold) {
    return Number(amount) > threshold;
}

/**
 * checkNewAccountLargeTransfer — Rule 4: New Account Large Transfer.
 *
 * True if the sending bank account was opened less than 24 hours ago AND
 * the amount is above the rule's threshold. The 24-hour window is fixed
 * here in code; only the amount threshold comes from the rule row, since
 * detection_rules has a single threshold column.
 *
 * This reads from `accounts` (customer bank accounts), NOT `users`.
 * It used to look the sender up in `users`, which holds staff logins —
 * so it never found anyone and the rule could never fire.
 */
async function checkNewAccountLargeTransfer(senderId, amount, dateTime, amountThreshold) {
    const account = await Account.findByPk(senderId);
    if (!account || !account.opened_at) return false;

    const oneDayMs = 24 * 60 * 60 * 1000;
    const accountAgeMs = new Date(dateTime) - new Date(account.opened_at);

    return accountAgeMs < oneDayMs && Number(amount) > amountThreshold;
}

/**
 * runDetection — applies every active rule to one transaction and
 * returns the total risk score, its traffic-light classification, and
 * which rules triggered (so an alert can explain why).
 *
 * Traffic-light scale:
 *   score  < 0.3            -> "green"  legitimate
 *   0.3 <= score <= 0.7     -> "yellow" suspicious
 *   score  > 0.7            -> "red"    fraud alert
 */
async function runDetection(transaction) {
    const activeRules = await DetectionRule.findAll({ where: { is_active: true }, raw: true });
    const graph = await buildTransactionGraph();

    let riskScore = 0;
    const triggeredRules = [];

    for (const rule of activeRules) {
        let triggered = false;

        if (rule.rule_type === "graph_pattern") {
            triggered = checkCircularPattern(graph, transaction.sender_id, transaction.receiver_id, rule.threshold);
        } else if (rule.rule_type === "frequency") {
            triggered = await checkHighFrequency(transaction.sender_id, transaction.date_time, rule.threshold);
        } else if (rule.rule_type === "amount_threshold") {
            triggered = checkLargeAmount(transaction.amount, rule.threshold);
        } else if (rule.rule_type === "account_age") {
            triggered = await checkNewAccountLargeTransfer(
                transaction.sender_id,
                transaction.amount,
                transaction.date_time,
                rule.threshold
            );
        }

        if (triggered) {
            riskScore += rule.weight;
            triggeredRules.push(rule.rule_name);
        }
    }

    // Cap at 1.0 — a transaction that trips every rule shouldn't produce
    // a score above what the traffic-light scale expects.
    riskScore = Math.min(riskScore, 1);

    // The red threshold is configurable by an admin (System Configuration
    // screen); it defaults to 0.7. Yellow starts at 0.3 as per the spec.
    const redThreshold = await getAlertThreshold();

    let classification;
    if (riskScore > redThreshold) {
        classification = "red";
    } else if (riskScore >= 0.3) {
        classification = "yellow";
    } else {
        classification = "green";
    }

    return { riskScore, classification, triggeredRules, redThreshold };
}

module.exports = {
    runDetection,
    buildTransactionGraph,
    checkCircularPattern,
    checkHighFrequency,
    checkLargeAmount,
    checkNewAccountLargeTransfer,
};
