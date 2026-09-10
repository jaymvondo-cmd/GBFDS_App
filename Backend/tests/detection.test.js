/*
 * The four detection rules and the traffic-light scoring.
 *
 * Runs against a separate test database so it never touches real data.
 */
const { createTestDatabaseIfMissing } = require("./setup");

let sequelize, Account, Transaction, DetectionRule, Setting, engine;

beforeAll(async () => {
    await createTestDatabaseIfMissing();

    const models = require("../models");
    sequelize = models.sequelize;
    Account = models.Account;
    Transaction = models.Transaction;
    DetectionRule = models.DetectionRule;
    Setting = models.Setting;
    engine = require("../services/detectionEngine.service");

    await sequelize.sync({ force: true });
}, 60000);

afterAll(async () => {
    if (sequelize) await sequelize.close();
});

beforeEach(async () => {
    await Transaction.destroy({ where: {} });
    await Account.destroy({ where: {} });
    await DetectionRule.destroy({ where: {} });
    await Setting.destroy({ where: {} });
});

const HOURS = 60 * 60 * 1000;

async function addRule(overrides) {
    return DetectionRule.create({
        rule_id: overrides.rule_id,
        rule_name: overrides.rule_name,
        rule_type: overrides.rule_type,
        threshold: overrides.threshold,
        weight: overrides.weight,
        is_active: overrides.is_active !== false,
        created_at: new Date(),
    });
}

describe("Rule 3 — Large Amount Transfer", () => {
    test("fires above the threshold and not on or below it", () => {
        expect(engine.checkLargeAmount(1500000, 1000000)).toBe(true);
        expect(engine.checkLargeAmount(1000000, 1000000)).toBe(false);
        expect(engine.checkLargeAmount(999999, 1000000)).toBe(false);
    });
});

describe("Rule 4 — New Account Large Transfer", () => {
    // This rule was silently broken: it looked the sender up in `users`
    // (staff logins) instead of `accounts` (customer accounts), so it could
    // never fire. These tests exist so that cannot happen again.
    beforeEach(async () => {
        await Account.create({
            account_id: 500,
            owner_name: "Brand New",
            opened_at: new Date(Date.now() - 3 * HOURS), // 3 hours old
        });
        await Account.create({
            account_id: 501,
            owner_name: "Long Standing",
            opened_at: new Date(Date.now() - 200 * 24 * HOURS), // ~200 days old
        });
    });

    test("fires for a new account sending a large amount", async () => {
        await expect(
            engine.checkNewAccountLargeTransfer(500, 600000, new Date(), 500000)
        ).resolves.toBe(true);
    });

    test("does not fire for a new account sending a small amount", async () => {
        await expect(
            engine.checkNewAccountLargeTransfer(500, 100000, new Date(), 500000)
        ).resolves.toBe(false);
    });

    test("does not fire for an established account, however large the amount", async () => {
        await expect(
            engine.checkNewAccountLargeTransfer(501, 9000000, new Date(), 500000)
        ).resolves.toBe(false);
    });

    test("does not fire for an account we have never seen", async () => {
        await expect(
            engine.checkNewAccountLargeTransfer(9999, 9000000, new Date(), 500000)
        ).resolves.toBe(false);
    });
});

describe("Rule 2 — High Frequency Transfers", () => {
    test("fires only once the sender has paid enough different accounts in an hour", async () => {
        const base = new Date();
        for (let i = 0; i < 4; i++) {
            await Transaction.create({
                transaction_id: "F" + i,
                sender_id: 700,
                receiver_id: 800 + i, // four DIFFERENT receivers
                amount: 1000,
                date_time: new Date(base.getTime() - (10 - i) * 60000),
            });
        }
        // Four distinct receivers is below a threshold of five.
        await expect(engine.checkHighFrequency(700, base, 5)).resolves.toBe(false);

        await Transaction.create({
            transaction_id: "F4",
            sender_id: 700,
            receiver_id: 900,
            amount: 1000,
            date_time: base,
        });
        await expect(engine.checkHighFrequency(700, base, 5)).resolves.toBe(true);
    });

    test("paying the SAME account repeatedly is not high frequency", async () => {
        const base = new Date();
        for (let i = 0; i < 6; i++) {
            await Transaction.create({
                transaction_id: "S" + i,
                sender_id: 710,
                receiver_id: 811, // always the same receiver
                amount: 1000,
                date_time: new Date(base.getTime() - i * 60000),
            });
        }
        await expect(engine.checkHighFrequency(710, base, 5)).resolves.toBe(false);
    });

    test("payments older than an hour do not count", async () => {
        const base = new Date();
        for (let i = 0; i < 6; i++) {
            await Transaction.create({
                transaction_id: "O" + i,
                sender_id: 720,
                receiver_id: 820 + i,
                amount: 1000,
                date_time: new Date(base.getTime() - 5 * HOURS), // long ago
            });
        }
        await expect(engine.checkHighFrequency(720, base, 5)).resolves.toBe(false);
    });
});

describe("Traffic-light classification", () => {
    async function scoreFor(amount) {
        const tx = await Transaction.create({
            transaction_id: "C" + Math.random().toString(36).slice(2, 9),
            sender_id: 1,
            receiver_id: 2,
            amount,
            date_time: new Date(),
        });
        return engine.runDetection(tx);
    }

    test("no rule triggered is green with a score of 0", async () => {
        const r = await scoreFor(100);
        expect(r.riskScore).toBe(0);
        expect(r.classification).toBe("green");
    });

    test("a single 0.5 rule lands in yellow", async () => {
        await addRule({ rule_id: "r-amt", rule_name: "Large Amount", rule_type: "amount_threshold", threshold: 1000, weight: 0.5 });
        const r = await scoreFor(5000);
        expect(r.riskScore).toBeCloseTo(0.5);
        expect(r.classification).toBe("yellow");
    });

    test("scoring above the threshold is red", async () => {
        await addRule({ rule_id: "r-a", rule_name: "A", rule_type: "amount_threshold", threshold: 1000, weight: 0.5 });
        await addRule({ rule_id: "r-b", rule_name: "B", rule_type: "amount_threshold", threshold: 2000, weight: 0.4 });
        const r = await scoreFor(5000);
        expect(r.riskScore).toBeCloseTo(0.9);
        expect(r.classification).toBe("red");
        expect(r.triggeredRules).toHaveLength(2);
    });

    test("exactly 0.7 is still yellow, because red is above the threshold", async () => {
        await addRule({ rule_id: "r-c", rule_name: "C", rule_type: "amount_threshold", threshold: 1000, weight: 0.7 });
        const r = await scoreFor(5000);
        expect(r.riskScore).toBeCloseTo(0.7);
        expect(r.classification).toBe("yellow");
    });

    test("the score never goes above 1 even if every rule fires", async () => {
        for (let i = 0; i < 5; i++) {
            await addRule({ rule_id: "r-m" + i, rule_name: "M" + i, rule_type: "amount_threshold", threshold: 10, weight: 0.5 });
        }
        const r = await scoreFor(5000);
        expect(r.riskScore).toBe(1);
    });

    test("an inactive rule is ignored", async () => {
        await addRule({ rule_id: "r-off", rule_name: "Off", rule_type: "amount_threshold", threshold: 1000, weight: 0.9, is_active: false });
        const r = await scoreFor(5000);
        expect(r.riskScore).toBe(0);
        expect(r.classification).toBe("green");
    });

    test("the admin's threshold setting changes what counts as red", async () => {
        await addRule({ rule_id: "r-t", rule_name: "T", rule_type: "amount_threshold", threshold: 1000, weight: 0.5 });

        // Default threshold is 0.7, so 0.5 is yellow.
        expect((await scoreFor(5000)).classification).toBe("yellow");

        // Lower it to 0.4 and the same transaction becomes red.
        await Setting.upsert({ setting_key: "alert_threshold", setting_value: "0.4", updated_at: new Date() });
        expect((await scoreFor(5000)).classification).toBe("red");
    });
});
