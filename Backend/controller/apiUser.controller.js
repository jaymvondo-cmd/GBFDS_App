const bcrypt = require("bcrypt");
const { User } = require("../models");
const { logAction } = require("../services/auditLog.service");

const ROLES = ["admin", "analyst"];

/**
 * listUsers — GET /api/users
 * Every account, minus the password hash.
 */
async function listUsers(req, res, next) {
    try {
        const users = await User.findAll({ attributes: { exclude: ["password"] } });
        res.json(users);
    } catch (err) {
        next(err);
    }
}

/**
 * createUser — POST /api/users
 * This is how a System Admin creates a new Fraud Analyst (or Admin)
 * account from the mobile app — the same job the web admin panel
 * already does, exposed here as JSON for the mobile client.
 */
async function createUser(req, res, next) {
    try {
        const { name, prename, email, telephone, password, role } = req.body;

        if (!name || !prename || !email || !password || !role) {
            return res.status(400).json({ error: "name, prename, email, password, and role are required" });
        }
        if (!ROLES.includes(role)) {
            return res.status(400).json({ error: "role must be 'admin' or 'analyst'" });
        }

        const existing = await User.findOne({ where: { email } });
        if (existing) {
            return res.status(409).json({ error: "An account with that email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            prename,
            email,
            telephone: telephone || null,
            password: hashedPassword,
            role,
        });

        await logAction(req.user.id, "USER_CREATED", `Created user ${user.email} (${role})`);

        const { password: _omit, ...safeUser } = user.toJSON();
        res.status(201).json(safeUser);
    } catch (err) {
        next(err);
    }
}

/**
 * updateUser — PUT /api/users/:id
 * Updates any of name/prename/email/telephone/role, and the password
 * only if a new one is included. This is also how a role gets
 * (re)assigned — send { role: "analyst" } or { role: "admin" }.
 */
async function updateUser(req, res, next) {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const { name, prename, email, telephone, role, password } = req.body;

        if (role !== undefined && !ROLES.includes(role)) {
            return res.status(400).json({ error: "role must be 'admin' or 'analyst'" });
        }

        if (name !== undefined) user.name = name;
        if (prename !== undefined) user.prename = prename;
        if (email !== undefined) user.email = email;
        if (telephone !== undefined) user.telephone = telephone;
        if (role !== undefined) user.role = role;
        if (password) user.password = await bcrypt.hash(password, 10);

        await user.save();
        await logAction(req.user.id, "USER_UPDATED", `Updated user ${user.email}`);

        const { password: _omit, ...safeUser } = user.toJSON();
        res.json(safeUser);
    } catch (err) {
        if (err.name === "SequelizeUniqueConstraintError" || err.name === "SequelizeValidationError") {
            return res.status(409).json({ error: "Please enter a valid, unique email address" });
        }
        next(err);
    }
}

/**
 * deleteUser — DELETE /api/users/:id
 * Same safeguard as the web admin panel: you can't delete the account
 * you're currently signed in as.
 */
async function deleteUser(req, res, next) {
    try {
        if (String(req.params.id) === String(req.user.id)) {
            return res.status(400).json({ error: "You can't delete your own account" });
        }

        const user = await User.findByPk(req.params.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        await user.destroy();
        await logAction(req.user.id, "USER_DELETED", `Deleted user ${user.email}`);

        res.json({ message: "User deleted" });
    } catch (err) {
        next(err);
    }
}

module.exports = { listUsers, createUser, updateUser, deleteUser };
