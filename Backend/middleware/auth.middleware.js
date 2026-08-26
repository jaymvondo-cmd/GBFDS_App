function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    if (req.path.startsWith("/api/")) {
        return res.status(401).json({ error: { message: "Authentication required" } });
    }
    return res.redirect("/login");
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            if (req.path.startsWith("/api/")) {
                return res.status(401).json({ error: { message: "Authentication required" } });
            }
            return res.redirect("/login");
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
