// Creates a customer bank account row for every account id that already
// appears in the transactions table, so sender_id / receiver_id actually
// point at something real.
//
// Most accounts are given an "opened_at" months in the past. A couple are
// deliberately opened in the last few hours, which is what the
// "New Account Large Transfer" rule looks for.
//
// Safe to run more than once: existing accounts are left alone.
require("dotenv").config();
const { sequelize, Account, Transaction } = require("../models");

const FIRST_NAMES = ["Awa", "Bello", "Chantal", "Divine", "Eric", "Fadi", "Grace", "Hamid", "Ines", "Joseph"];
const LAST_NAMES = ["Ndongo", "Fotso", "Mbarga", "Tchoua", "Njoya", "Sadou", "Kamga", "Etoa", "Bakari", "Nkeng"];
const TYPES = ["current", "savings", "business"];

function nameFor(id) {
    return FIRST_NAMES[id % FIRST_NAMES.length] + " " + LAST_NAMES[Math.floor(id / 7) % LAST_NAMES.length];
}

async function seedAccounts() {
    // Every distinct account id used by any transaction, either side.
    const [rows] = await sequelize.query(
        "SELECT sender_id AS id FROM transactions UNION SELECT receiver_id FROM transactions"
    );
    const ids = rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);

    if (ids.length === 0) {
        console.log("No transactions yet, so there are no accounts to create.");
        console.log("Run `npm run seed:transactions` first.");
        return { created: 0, skipped: 0, newAccounts: [] };
    }

    // The two accounts that open the deliberate fraud ring are treated as
    // brand new, so Rule 4 has a genuine case to catch.
    const BRAND_NEW = [1002, 1004];

    let created = 0;
    let skipped = 0;
    const newAccounts = [];

    for (const id of ids) {
        const existing = await Account.findByPk(id);
        if (existing) {
            skipped++;
            continue;
        }

        let openedAt;
        if (BRAND_NEW.includes(id)) {
            // A few hours ago — inside the rule's 24 hour window.
            openedAt = new Date(Date.now() - 5 * 60 * 60 * 1000);
            newAccounts.push(id);
        } else {
            // Somewhere between 1 and 24 months ago.
            const monthsOld = 1 + (id % 24);
            openedAt = new Date(Date.now() - monthsOld * 30 * 24 * 60 * 60 * 1000);
        }

        await Account.create({
            account_id: id,
            owner_name: nameFor(id),
            account_type: TYPES[id % TYPES.length],
            opened_at: openedAt,
            status: "active",
        });
        created++;
    }

    return { created, skipped, newAccounts };
}

seedAccounts()
    .then((r) => {
        if (r.created === 0 && r.skipped === 0) return;
        console.log(`Created ${r.created} account(s), skipped ${r.skipped} that already existed.`);
        if (r.newAccounts.length) {
            console.log(`Opened in the last 24 hours (Rule 4 will flag large transfers from these): ${r.newAccounts.join(", ")}`);
        }
    })
    .catch((err) => {
        console.error("Seeding accounts failed:", err);
        process.exitCode = 1;
    })
    .finally(() => sequelize.close());
