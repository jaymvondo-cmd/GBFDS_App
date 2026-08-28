// Seeds the 4 starter detection rules into the detection_rules table.
// Safe to run more than once — it skips a rule if that rule_id already
// exists, instead of creating duplicates.
require("dotenv").config();
const { sequelize, DetectionRule } = require("../models");

// The rules the fraud detection engine will apply to every new
// transaction. `threshold` is the one number each rule checks against;
// `weight` is how much risk score it adds when it triggers.
const STARTER_RULES = [
    {
        rule_id: "rule-circular-pattern",
        rule_name: "Circular Transaction Pattern",
        description: "Triggers when a circular payment path is found between 3 or more accounts (A pays B, B pays C, C pays back to A).",
        rule_type: "graph_pattern",
        condition_field: "circular_path",
        threshold: 3, // minimum number of accounts in the cycle
        weight: 0.5,
        is_active: true,
        created_by: "system",
    },
    {
        rule_id: "rule-high-frequency",
        rule_name: "High Frequency Transfers",
        description: "Triggers when the same account sends money to 5 or more different accounts within 1 hour.",
        rule_type: "frequency",
        condition_field: "distinct_receivers_per_hour",
        threshold: 5,
        weight: 0.3,
        is_active: true,
        created_by: "system",
    },
    {
        rule_id: "rule-large-amount",
        rule_name: "Large Amount Transfer",
        description: "Triggers when a single transaction amount is greater than 1,000,000 FCFA.",
        rule_type: "amount_threshold",
        condition_field: "amount",
        threshold: 1000000,
        weight: 0.2,
        is_active: true,
        created_by: "system",
    },
    {
        rule_id: "rule-new-account-transfer",
        rule_name: "New Account Large Transfer",
        description: "Triggers when an account created less than 24 hours ago sends more than 500,000 FCFA. (The 24-hour window is fixed in the detection engine; this rule's threshold controls the amount.)",
        rule_type: "account_age",
        condition_field: "amount",
        threshold: 500000,
        weight: 0.4,
        is_active: true,
        created_by: "system",
    },
];

async function seedRules() {
    for (const rule of STARTER_RULES) {
        const existing = await DetectionRule.findByPk(rule.rule_id);
        if (existing) {
            console.log(`Rule "${rule.rule_id}" already exists, skipping.`);
            continue;
        }
        await DetectionRule.create(rule);
        console.log(`Created rule: ${rule.rule_id}`);
    }
}

seedRules()
    .catch((err) => {
        console.error("Seeding rules failed:", err);
        process.exitCode = 1;
    })
    .finally(() => sequelize.close());
