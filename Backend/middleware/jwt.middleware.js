const jwt = require("jsonwebtoken");

/**
 * verifyToken — checks that the request carries a valid JWT in the
 * Authorization header, formatted as "Bearer <token>".
 *
 * This is the mobile-app equivalent of the web app's session check
 * (see middleware/auth.middleware.js) — same idea, different transport:
 * the web app reads a cookie, the mobile app sends a token on every
 * request instead.
 *
 * If the token is missing or invalid, the request stops here with 401
 * and never reaches the actual route handler. If it's valid, the
 * decoded payload (id, email, role) is attached to req.user so later
 * code knows who is asking.
 */
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = authHeader.slice("Bearer ".length);

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        req.user = decoded;
        next();
    });
}

/**
 * requireRole — only lets the request through if req.user's role is one
 * of the allowed roles. Must be used AFTER verifyToken, since it needs
 * req.user to already be set.
 *
 * Example: router.get("/users", verifyToken, requireRole("admin"), listUsers)
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: "Forbidden" });
        }
        next();
    };
}

module.exports = { verifyToken, requireRole };
