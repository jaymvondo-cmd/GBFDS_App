/*
 * API and access-control tests.
 *
 * These cover the promises the app makes about who can do what:
 * logging in with the wrong profile fails, an analyst cannot reach admin
 * pages, and an admin cannot decide on an alert.
 */
const { createTestDatabaseIfMissing } = require("./setup");
const request = require("supertest");
const bcrypt = require("bcrypt");

let app, sequelize, User, Account, Transaction, Alert;

const ADMIN = { email: "admin@test.local", password: "AdminPass123" };
const ANALYST = { email: "analyst@test.local", password: "AnalystPass123" };

beforeAll(async () => {
    await createTestDatabaseIfMissing();

    const models = require("../models");
    sequelize = models.sequelize;
    User = models.User;
    Account = models.Account;
    Transaction = models.Transaction;
    Alert = models.Alert;

    await sequelize.sync({ force: true });
    app = require("../server");

    await User.create({
        name: "Test", prename: "Admin", email: ADMIN.email,
        password: await bcrypt.hash(ADMIN.password, 10), role: "admin",
    });
    await User.create({
        name: "Test", prename: "Analyst", email: ANALYST.email,
        password: await bcrypt.hash(ANALYST.password, 10), role: "analyst",
    });
}, 60000);

afterAll(async () => {
    if (sequelize) await sequelize.close();
});

/** Log in through the mobile API and return the JWT. */
async function tokenFor(who, profile) {
    const res = await request(app)
        .post("/api/auth/login")
        .send({ email: who.email, password: who.password, profile });
    return res.body.token;
}

describe("Login", () => {
    test("correct credentials on the matching profile succeed", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: ADMIN.email, password: ADMIN.password, profile: "SystemAdmin" });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeTruthy();
        expect(res.body.user.role).toBe("admin");
    });

    test("the password is never sent back", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: ADMIN.email, password: ADMIN.password, profile: "SystemAdmin" });
        expect(JSON.stringify(res.body)).not.toContain(ADMIN.password);
        expect(res.body.user.password).toBeUndefined();
    });

    test("valid admin credentials on the ANALYST profile are rejected", async () => {
        // This is the specific behaviour that was asked for: the profile
        // you pick has to match the account, or it fails.
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: ADMIN.email, password: ADMIN.password, profile: "FraudAnalyst" });
        expect(res.status).toBe(401);
        expect(res.body.token).toBeUndefined();
    });

    test("valid analyst credentials on the ADMIN profile are rejected", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: ANALYST.email, password: ANALYST.password, profile: "SystemAdmin" });
        expect(res.status).toBe(401);
    });

    test("a wrong password is rejected", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: ADMIN.email, password: "not-the-password", profile: "SystemAdmin" });
        expect(res.status).toBe(401);
    });

    test("the error message does not reveal which part was wrong", async () => {
        const wrongPassword = await request(app)
            .post("/api/auth/login")
            .send({ email: ADMIN.email, password: "nope", profile: "SystemAdmin" });
        const unknownEmail = await request(app)
            .post("/api/auth/login")
            .send({ email: "nobody@test.local", password: "nope", profile: "SystemAdmin" });
        expect(wrongPassword.body.error).toBe(unknownEmail.body.error);
    });
});

describe("Access control", () => {
    test("no token means no access", async () => {
        expect((await request(app).get("/api/users")).status).toBe(401);
        expect((await request(app).get("/api/alerts")).status).toBe(401);
    });

    test("a made-up token is rejected", async () => {
        const res = await request(app)
            .get("/api/alerts")
            .set("Authorization", "Bearer not-a-real-token");
        expect(res.status).toBe(401);
    });

    test("an analyst cannot list or create users", async () => {
        const token = await tokenFor(ANALYST, "FraudAnalyst");
        expect((await request(app).get("/api/users").set("Authorization", `Bearer ${token}`)).status).toBe(403);
        expect(
            (await request(app).post("/api/users").set("Authorization", `Bearer ${token}`)
                .send({ name: "X", prename: "Y", email: "x@test.local", password: "Password123", role: "analyst" })).status
        ).toBe(403);
    });

    test("an analyst cannot change detection rules", async () => {
        const token = await tokenFor(ANALYST, "FraudAnalyst");
        expect((await request(app).get("/api/rules").set("Authorization", `Bearer ${token}`)).status).toBe(403);
    });

    test("an analyst CAN read alerts and system health", async () => {
        const token = await tokenFor(ANALYST, "FraudAnalyst");
        expect((await request(app).get("/api/alerts").set("Authorization", `Bearer ${token}`)).status).toBe(200);
        expect((await request(app).get("/api/health").set("Authorization", `Bearer ${token}`)).status).toBe(200);
    });

    test("an admin can manage users and rules", async () => {
        const token = await tokenFor(ADMIN, "SystemAdmin");
        expect((await request(app).get("/api/users").set("Authorization", `Bearer ${token}`)).status).toBe(200);
        expect((await request(app).get("/api/rules").set("Authorization", `Bearer ${token}`)).status).toBe(200);
    });

    test("an admin cannot delete their own account", async () => {
        const token = await tokenFor(ADMIN, "SystemAdmin");
        const me = await User.findOne({ where: { email: ADMIN.email } });
        const res = await request(app).delete(`/api/users/${me.id}`).set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(400);
        expect(await User.findByPk(me.id)).not.toBeNull();
    });
});

describe("Separation of duties", () => {
    // An admin configures the rules that raise alerts, so they must not
    // also be the one clearing those alerts.
    beforeAll(async () => {
        await Account.create({ account_id: 1, owner_name: "A", opened_at: new Date() });
        await Transaction.create({
            transaction_id: "TXN-SOD", sender_id: 1, receiver_id: 2,
            amount: 5000, date_time: new Date(), classification: "red", risk_score: 0.9,
        });
        await Alert.create({
            alert_id: "ALERT-SOD", transaction_id: "TXN-SOD",
            risk_score: 0.9, risk_level: "red", reason: "test",
            alert_status: "pending", created_at: new Date(),
        });
    });

    test("an admin posting a decision is refused, and the alert is unchanged", async () => {
        const agent = request.agent(app);
        await agent.post("/auth/login").type("form")
            .send({ email: ADMIN.email, password: ADMIN.password, portal: "admin" });

        const res = await agent.post("/alerts/ALERT-SOD").type("form").send({ action: "confirmed" });
        expect(res.status).toBe(403);

        const alert = await Alert.findByPk("ALERT-SOD");
        expect(alert.alert_status).toBe("pending");
    });

    test("an analyst can confirm the same alert", async () => {
        const agent = request.agent(app);
        await agent.post("/auth/login").type("form")
            .send({ email: ANALYST.email, password: ANALYST.password, portal: "analyst" });

        await agent.post("/alerts/ALERT-SOD").type("form")
            .send({ action: "confirmed", analyst_comment: "checked" });

        const alert = await Alert.findByPk("ALERT-SOD");
        expect(alert.alert_status).toBe("confirmed");
        expect(alert.analyst_comment).toBe("checked");

        // The decision is reflected on the transaction too.
        const tx = await Transaction.findByPk("TXN-SOD");
        expect(tx.transaction_status).toBe("confirmed_fraud");
    });
});

describe("Session security", () => {
    test("deleting a user immediately ends their session", async () => {
        const victim = await User.create({
            name: "Temp", prename: "User", email: "temp@test.local",
            password: await bcrypt.hash("TempPass123", 10), role: "analyst",
        });

        const agent = request.agent(app);
        await agent.post("/auth/login").type("form")
            .send({ email: "temp@test.local", password: "TempPass123", portal: "analyst" });

        // Works while the account exists.
        expect((await agent.get("/alerts")).status).toBe(200);

        await victim.destroy();

        // The same session is now bounced to the login page.
        const after = await agent.get("/alerts");
        expect(after.status).toBe(302);
        expect(after.headers.location).toBe("/login");
    });
});
