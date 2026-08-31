const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { User } = require("../models");
const { clearLoginAttempts } = require("../middleware/rateLimit.middleware");
const { logAction } = require("../services/auditLog.service");

// The mobile app's profile-selection screen shows "Fraud Analyst" or
// "System Admin". This maps those choices to the role values actually
// stored in the users table (admin / analyst) — same values the web
// app already uses, so both apps share one users table without
// conflict.
const PROFILE_TO_ROLE = {
    FraudAnalyst: "analyst",
    SystemAdmin: "admin",
};

/**
 * login — POST /api/auth/login
 *
 * The mobile app sends { email, password, profile }. All three are
 * checked against the database: the email must exist, the password
 * must match, AND the account's actual role must match the profile the
 * user picked. If any one of those three is wrong, the response is the
 * exact same generic error — this mirrors how the web app's two login
 * portals work, so a wrong profile pick never reveals whether the
 * email or password was the problem.
 *
 * Per the spec, there is no lockout after repeated failed attempts.
 *
 * On success, a JWT is returned. The mobile app must send it back on
 * every later request as: Authorization: Bearer <token>
 */
async function login(req, res, next) {
    try {
        const { email, password, profile } = req.body;
        const role = PROFILE_TO_ROLE[profile];

        if (!email || !password || !role) {
            return res.status(400).json({
                error: "email, password, and profile ('FraudAnalyst' or 'SystemAdmin') are required",
            });
        }

        const user = await User.findOne({ where: { email } });
        const passwordMatches = user && (await bcrypt.compare(password, user.password));
        const roleMatches = user && user.role === role;

        if (!passwordMatches || !roleMatches) {
            return res.status(401).json({ error: "Invalid email, password, or profile" });
        }

        // Signing in correctly wipes this computer's failed-attempt count.
        clearLoginAttempts(req);

        const now = new Date();
        await user.update({ last_login_at: now, last_seen_at: now }, { silent: true });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "12h" }
        );

        await logAction(user.id, "LOGIN", `Mobile login as ${user.role}`);

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                prename: user.prename,
                email: user.email,
                role: user.role,
            },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { login };
