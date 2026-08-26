require("dotenv").config();
const bcrypt = require("bcrypt");
const { sequelize, User } = require("../models");

async function seed() {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;

    if (!email || !password) {
        throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env");
    }

    await sequelize.sync({ alter: true });

    const existing = await User.findOne({ where: { email } });
    if (existing) {
        console.log(`Admin ${email} already exists, skipping.`);
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
        name: "Admin",
        prename: "",
        telephone: "",
        email,
        password: hashedPassword,
        role: "admin",
    });

    console.log(`Created admin account: ${email}`);
}

seed()
    .catch((err) => {
        console.error("Seed failed:", err);
        process.exitCode = 1;
    })
    .finally(() => sequelize.close());
