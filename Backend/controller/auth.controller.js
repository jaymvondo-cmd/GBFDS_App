const bcrypt = require("bcrypt");
const { User } = require("../models");

function showLogin(req, res) {
    if (req.session && req.session.user) {
        return res.redirect("/dashboard");
    }
    res.render("auth/login", { error: null });
}

function showSignup(req, res) {
    if (req.session && req.session.user) {
        return res.redirect("/dashboard");
    }
    res.render("auth/signup", { error: null, values: {} });
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).render("auth/login", {
                error: "Email and password are required",
                email,
            });
        }

        const user = await User.findOne({ where: { email } });
        const passwordMatches = user && (await bcrypt.compare(password, user.password));

        if (!passwordMatches) {
            return res.status(401).render("auth/login", {
                error: "Invalid email or password",
                email,
            });
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            prename: user.prename,
            email: user.email,
            role: user.role,
        };

        res.redirect("/dashboard");
    } catch (err) {
        next(err);
    }
}

async function signup(req, res, next) {
    try {
        const { prename, name, email, telephone, password, confirmPassword } = req.body;
        const values = { prename, name, email, telephone };

        if (!prename || !name || !email || !password || !confirmPassword) {
            return res.status(400).render("auth/signup", {
                error: "Please fill in all required fields",
                values,
            });
        }

        if (password.length < 8) {
            return res.status(400).render("auth/signup", {
                error: "Password must be at least 8 characters",
                values,
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).render("auth/signup", {
                error: "Passwords do not match",
                values,
            });
        }

        const existing = await User.findOne({ where: { email } });
        if (existing) {
            return res.status(409).render("auth/signup", {
                error: "An account with that email already exists",
                values,
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            prename,
            name,
            email,
            telephone: telephone || null,
            password: hashedPassword,
            role: "analyst",
        });

        req.session.user = {
            id: user.id,
            name: user.name,
            prename: user.prename,
            email: user.email,
            role: user.role,
        };

        res.redirect("/dashboard");
    } catch (err) {
        if (err.name === "SequelizeValidationError" || err.name === "SequelizeUniqueConstraintError") {
            return res.status(400).render("auth/signup", {
                error: "Please enter a valid, unique email address",
                values: req.body,
            });
        }
        next(err);
    }
}

function logout(req, res, next) {
    req.session.destroy((err) => {
        if (err) return next(err);
        res.redirect("/login");
    });
}

module.exports = { showLogin, showSignup, login, signup, logout };
