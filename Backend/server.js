const path = require("path");
const express = require("express");
const session = require("express-session");
const SequelizeStore = require("connect-session-sequelize")(session.Store);
require("dotenv").config();

const { sequelize } = require("./models");
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
            maxAge: 1000 * 60 * 60 * 24, // 1 day
        },
    })
);

sessionStore.sync();

// Web app (session cookies, server-rendered EJS pages)
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
