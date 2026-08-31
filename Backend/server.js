const path = require("path");
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const SequelizeStore = require("connect-session-sequelize")(session.Store);
require("dotenv").config();

const { sequelize } = require("./models");
const { loginRateLimit } = require("./middleware/rateLimit.middleware");
const authRouter = require("./router/auth.router");
const viewRouter = require("./router/view.router");
const adminRouter = require("./router/admin.router");
const dashboardRouter = require("./router/dashboard.router");
const analystRouter = require("./router/analyst.router");

// Mobile app API routes (JWT-authenticated JSON, separate from the
// session-based web app above).
const mobileAuthRouter = require("./router/mobileAuth.router");
const transactionRouter = require("./router/transaction.router");
const alertRouter = require("./router/alert.router");
const apiUserRouter = require("./router/apiUser.router");
const ruleRouter = require("./router/rule.router");
const systemRouter = require("./router/system.router");

const app = express();

// Sensible security headers (clickjacking, MIME sniffing, referrer, etc).
// The CSP is relaxed for the Chart.js CDN the dashboard loads.
// The app is served over plain HTTP in development and over the local
// network. Two of helmet's defaults must stay OFF here or the browser will
// force https:// and the site becomes unreachable:
//   - HSTS tells the browser "only ever use https for this host", and it is
//     remembered for a year, so it would break http access even after the
//     header is removed.
//   - upgrade-insecure-requests rewrites http requests to https.
// Turn both on again if this is ever deployed behind real HTTPS.
const servedOverHttps = process.env.HTTPS === "true";

app.use(
    helmet({
        hsts: servedOverHttps,
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:"],
                connectSrc: ["'self'"],
                upgradeInsecureRequests: servedOverHttps ? [] : null,
            },
        },
    })
);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const sessionStore = new SequelizeStore({ db: sequelize });

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        store: sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            // "lax" stops another website from making your browser submit a
            // form to this app while you are logged in (a CSRF attack),
            // while still letting normal links into the app work.
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24, // 1 day
        },
    })
);

sessionStore.sync();

// Web app (session cookies, server-rendered EJS pages)
app.post("/auth/login", loginRateLimit);
app.post("/api/auth/login", loginRateLimit);
app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/", analystRouter);
app.use("/", viewRouter);

// Mobile app API (JWT, JSON)
app.use("/api/auth", mobileAuthRouter);
app.use("/api", transactionRouter);
app.use("/api", alertRouter);
app.use("/api", apiUserRouter);
app.use("/api", ruleRouter);
app.use("/api", systemRouter);

// 404 for any /api/* route that didn't match above — as JSON, not HTML,
// since a mobile client can't do anything useful with an HTML page.
app.use("/api", (req, res) => {
    res.status(404).json({ error: "Not found" });
});

// Central error handler — must be defined last. Anything an /api/*
// route calls next(err) with ends up here as JSON instead of Express's
// default HTML error page, which a mobile client couldn't parse.
app.use((err, req, res, next) => {
    console.error(err);
    if (req.path.startsWith("/api/")) {
        return res.status(500).json({ error: "Something went wrong" });
    }
    res.status(500).send("Something went wrong");
});

// Export the configured app so the tests can drive it with supertest.
module.exports = app;

// Only actually listen when this file is run directly (npm start).
// Requiring it from a test must not open a real port.
function startServer() {
    const PORT = process.env.PORT || 3000;
    let startupFailed = false;

    const server = app.listen(PORT);

    // Without this, a port clash throws an uncaught exception and node exits
    // instantly — which just looks like the terminal closing on its own.
    server.on("error", (err) => {
        startupFailed = true;

        if (err.code === "EADDRINUSE") {
            console.error(`\nPort ${PORT} is already being used by another program.`);
            console.error("Another copy of this server is probably still running.");
            console.error(`Close it, or find it with:  netstat -ano | findstr :${PORT}\n`);
        } else {
            console.error("\nThe server could not start:", err.message, "\n");
        }
        process.exit(1);
    });

    // On Windows the "listening" event can fire for one half of the dual-stack
    // bind before EADDRINUSE surfaces for the other, so printing the banner
    // straight away would announce success on a run that is about to die.
    // Waiting a tick lets the error land first.
    server.on("listening", () => {
        setImmediate(() => {
            if (startupFailed) return;
            console.log(`Server is running on port ${PORT}`);
            console.log(`  On this computer:  http://localhost:${PORT}`);
            console.log(`  On your phone:     http://<this-pc-ip>:${PORT}  (same Wi-Fi; find the IP with "ipconfig")`);
        });
    });
}

if (require.main === module) {
    startServer();
}

// A failed database query in a background task (not tied to a request)
// would otherwise take the whole process down with no explanation.
process.on("unhandledRejection", (reason) => {
    console.error("\nUnhandled promise rejection:", reason, "\n");
});
