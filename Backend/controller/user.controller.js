const bcrypt = require("bcrypt");
const { User } = require("../models");

const ROLES = ["admin", "analyst"];

async function listUsers(req, res, next) {
    try {
        const users = await User.findAll({ order: [["createdAt", "DESC"]] });
        const adminCount = users.filter((u) => u.role === "admin").length;
        const analystCount = users.filter((u) => u.role === "analyst").length;
        res.render("admin/users/index", {
            user: req.session.user,
            active: "users",
            users,
            adminCount,
            analystCount,
            success: req.query.success || null,
        });
    } catch (err) {
        next(err);
    }
}

function showCreateForm(req, res) {
    res.render("admin/users/form", {
        user: req.session.user,
        active: "users",
        mode: "create",
        error: null,
        values: { role: "analyst" },
    });
}

async function createUser(req, res, next) {
    try {
        const { prename, name, email, telephone, role, password, confirmPassword } = req.body;
        const values = { prename, name, email, telephone, role };

        if (!prename || !name || !email || !role || !password || !confirmPassword) {
            return res.status(400).render("admin/users/form", {
                user: req.session.user,
                active: "users",
                mode: "create",
                error: "Please fill in all required fields",
                values,
            });
        }

        if (!ROLES.includes(role)) {
            return res.status(400).render("admin/users/form", {
                user: req.session.user,
                active: "users",
                mode: "create",
                error: "Invalid role selected",
                values,
            });
        }

        if (password.length < 8) {
            return res.status(400).render("admin/users/form", {
                user: req.session.user,
                active: "users",
                mode: "create",
                error: "Password must be at least 8 characters",
                values,
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).render("admin/users/form", {
                user: req.session.user,
                active: "users",
                mode: "create",
                error: "Passwords do not match",
                values,
            });
        }

        const existing = await User.findOne({ where: { email } });
        if (existing) {
            return res.status(409).render("admin/users/form", {
                user: req.session.user,
                active: "users",
                mode: "create",
                error: "An account with that email already exists",
                values,
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await User.create({
            prename,
            name,
            email,
            telephone: telephone || null,
            password: hashedPassword,
            role,
        });

        res.redirect("/admin/users?success=" + encodeURIComponent(`${prename} ${name} was created`));
    } catch (err) {
        if (err.name === "SequelizeValidationError" || err.name === "SequelizeUniqueConstraintError") {
            return res.status(400).render("admin/users/form", {
                user: req.session.user,
                active: "users",
                mode: "create",
                error: "Please enter a valid, unique email address",
                values: req.body,
            });
        }
        next(err);
    }
}

async function showEditForm(req, res, next) {
    try {
        const target = await User.findByPk(req.params.id);
        if (!target) {
            return res.redirect("/admin/users");
        }
        res.render("admin/users/form", {
            user: req.session.user,
            active: "users",
            mode: "edit",
            error: null,
            targetId: target.id,
            values: {
                prename: target.prename,
                name: target.name,
                email: target.email,
                telephone: target.telephone,
                role: target.role,
            },
        });
    } catch (err) {
        next(err);
    }
}

async function updateUser(req, res, next) {
    try {
        const target = await User.findByPk(req.params.id);
        if (!target) {
            return res.redirect("/admin/users");
        }

        const { prename, name, email, telephone, role, password, confirmPassword } = req.body;
        const values = { prename, name, email, telephone, role };
        const renderError = (error, status = 400) =>
            res.status(status).render("admin/users/form", {
                user: req.session.user,
                active: "users",
                mode: "edit",
                error,
                targetId: target.id,
                values,
            });

        if (!prename || !name || !email || !role) {
            return renderError("Please fill in all required fields");
        }

        if (!ROLES.includes(role)) {
            return renderError("Invalid role selected");
        }

        // Prevent an admin from demoting the account they're currently using,
        // which would otherwise lock them out of the admin portal mid-edit.
        if (target.id === req.session.user.id && role !== "admin") {
            return renderError("You can't change your own role");
        }

        if (password || confirmPassword) {
            if (password.length < 8) {
                return renderError("Password must be at least 8 characters");
            }
            if (password !== confirmPassword) {
                return renderError("Passwords do not match");
            }
        }

        const existing = await User.findOne({ where: { email } });
        if (existing && existing.id !== target.id) {
            return renderError("An account with that email already exists", 409);
        }

        target.prename = prename;
        target.name = name;
        target.email = email;
        target.telephone = telephone || null;
        target.role = role;
        if (password) {
            target.password = await bcrypt.hash(password, 10);
        }
        await target.save();

        // Keep the session in sync if the admin just edited their own account.
        if (target.id === req.session.user.id) {
            req.session.user = {
                id: target.id,
                name: target.name,
                prename: target.prename,
                email: target.email,
                role: target.role,
            };
        }

        res.redirect("/admin/users?success=" + encodeURIComponent(`${prename} ${name} was updated`));
    } catch (err) {
        if (err.name === "SequelizeValidationError" || err.name === "SequelizeUniqueConstraintError") {
            return res.status(400).render("admin/users/form", {
                user: req.session.user,
                active: "users",
                mode: "edit",
                error: "Please enter a valid, unique email address",
                targetId: req.params.id,
                values: req.body,
            });
        }
        next(err);
    }
}

async function deleteUser(req, res, next) {
    try {
        if (String(req.params.id) === String(req.session.user.id)) {
            return res.redirect("/admin/users?success=" + encodeURIComponent("You can't delete your own account"));
        }

        const target = await User.findByPk(req.params.id);
        if (target) {
            await target.destroy();
        }

        res.redirect("/admin/users?success=" + encodeURIComponent("Account deleted"));
    } catch (err) {
        next(err);
    }
}

module.exports = { listUsers, showCreateForm, createUser, showEditForm, updateUser, deleteUser };
