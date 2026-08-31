/*
 * A small rate limiter for the login pages.
 *
 * The spec says accounts must never be locked after failed attempts, and
 * this respects that: nothing here touches the account. It only slows down
 * one *computer* (IP address) that is guessing passwords very fast. A real
 * person typing a wrong password a few times is unaffected; a script trying
 * thousands of passwords is stopped.
 *
 * Attempts are kept in memory, so they reset when the server restarts.
 * That is fine here — a bigger system would keep them in Redis so the limit
 * still works across several servers.
 */

const WINDOW_MS = 10 * 60 * 1000; // remember attempts for 10 minutes
const MAX_ATTEMPTS = 10; // per IP, per window

const attemptsByIp = new Map();

function cleanUp(now) {
    for (const [ip, record] of attemptsByIp) {
        if (now - record.firstAttemptAt > WINDOW_MS) attemptsByIp.delete(ip);
    }
}

/**
 * loginRateLimit — blocks an IP that has made too many login attempts.
 * Put this in front of the login routes only.
 */
function loginRateLimit(req, res, next) {
    const now = Date.now();
    const ip = req.ip || req.connection.remoteAddress || "unknown";

    // Keep the map from growing forever.
    if (attemptsByIp.size > 5000) cleanUp(now);

    let record = attemptsByIp.get(ip);

    // First attempt, or the previous window has expired.
    if (!record || now - record.firstAttemptAt > WINDOW_MS) {
        record = { count: 0, firstAttemptAt: now };
        attemptsByIp.set(ip, record);
    }

    record.count += 1;

    if (record.count > MAX_ATTEMPTS) {
        const waitMinutes = Math.ceil((WINDOW_MS - (now - record.firstAttemptAt)) / 60000);

        if (req.path.startsWith("/api/")) {
            return res.status(429).json({
                error: `Too many login attempts. Try again in about ${waitMinutes} minute(s).`,
            });
        }
        return res.status(429).render("auth/login", {
            error: `Too many login attempts from this computer. Please wait about ${waitMinutes} minute(s).`,
            email: req.body ? req.body.email : "",
            portal: req.body && req.body.portal === "admin" ? "admin" : "analyst",
        });
    }

    next();
}

/**
 * clearLoginAttempts — called after a successful login so that signing in
 * correctly wipes the slate for that IP.
 */
function clearLoginAttempts(req) {
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    attemptsByIp.delete(ip);
}

module.exports = { loginRateLimit, clearLoginAttempts, MAX_ATTEMPTS };
