const bcrypt = require("bcrypt");
const { User } = require("../models");

async function showLogin(req, res) {
    if (req.session && req.session.user) {
        return res.redirect("/dashboard");
    }
    res.render("login", { error: null });
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).render("login", { error: "Email and password are required" });
        }

        const user = await User.findOne({ where: { email } });
        const passwordMatches = user && (await bcrypt.compare(password, user.password));

        if (!passwordMatches) {
            return res.status(401).render("login", { error: "Invalid email or password" });
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

function logout(req, res, next) {
    req.session.destroy((err) => {
        if (err) return next(err);
        res.redirect("/login");
    });
}

module.exports = { showLogin, login, logout };
