const { User } = require("../models");

function rejectUnauthenticated(req, res) {
    if (req.path.startsWith("/api/")) {
        return res.status(401).json({ error: { message: "Authentication required" } });
    }
    return res.redirect("/login");
}

/**
 * requireAuth — allows the request through only if there is a logged-in
 * session AND that account still exists with the same role.
 *
 * The re-check against the database matters: without it, deleting an
 * account (or demoting an admin to analyst) would leave that person
 * working normally until their cookie expired, because everything the
 * app needs was copied into the session at login. For a fraud system,
 * "access revoked" has to mean revoked now, not up to a day later.
 *
 * Cost is one primary-key lookup per request, which is cheap and worth
 * it here.
 */
async function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return rejectUnauthenticated(req, res);
    }

    try {
        const current = await User.findByPk(req.session.user.id);

        if (!current || current.role !== req.session.user.role) {
            return req.session.destroy(() => rejectUnauthenticated(req, res));
        }

        return next();
    } catch (err) {
        return next(err);
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return rejectUnauthenticated(req, res);
        }
        if (!roles.includes(req.session.user.role)) {
            if (req.path.startsWith("/api/")) {
                return res.status(403).json({ error: { message: "Forbidden" } });
            }
            return res.status(403).send("Forbidden");
        }
        return next();
    };
}

module.exports = { requireAuth, requireRole };
