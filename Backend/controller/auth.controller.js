const bcrypt = require("bcrypt");
const { User } = require("../models");
const { clearLoginAttempts } = require("../middleware/rateLimit.middleware");

const PORTALS = ["admin", "analyst"];

function showPortalSelect(req, res) {
    if (req.session && req.session.user) {
        return res.redirect("/dashboard");
    }
    res.render("auth/select-portal");
}

function showLogin(req, res) {
    const { portal } = req.params;

    if (!PORTALS.includes(portal)) {
        return res.redirect("/login");
    }

    if (req.session && req.session.user) {
        return res.redirect("/dashboard");
    }

    res.render("auth/login", { error: null, email: "", portal });
}

async function login(req, res, next) {
    try {
        const { email, password, portal } = req.body;
        const safePortal = PORTALS.includes(portal) ? portal : "analyst";

        if (!email || !password) {
            return res.status(400).render("auth/login", {
                error: "Email and password are required",
                email,
                portal: safePortal,
            });
        }

        const user = await User.findOne({ where: { email } });
        const passwordMatches = user && (await bcrypt.compare(password, user.password));
        const roleMatches = user && user.role === safePortal;

        // Deliberately one generic message for every failure reason (wrong
        // email, wrong password, or right credentials on the wrong portal)
        // so a login attempt never reveals which part was wrong.
        if (!passwordMatches || !roleMatches) {
            return res.status(401).render("auth/login", {
                error: "Invalid email or password",
                email,
                portal: safePortal,
            });
        }

        // Signing in correctly wipes this computer's failed-attempt count.
        clearLoginAttempts(req);

        const now = new Date();
        await user.update({ last_login_at: now, last_seen_at: now }, { silent: true });

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

module.exports = { showPortalSelect, showLogin, login, logout };
