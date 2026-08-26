const express = require("express");
const session = require("express-session");
const SequelizeStore = require("connect-session-sequelize")(session.Store);
require("dotenv").config();

const { sequelize } = require("./models");
const authRouter = require("./router/auth.router");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use("/auth", authRouter);

// definition of remaining routes and treatments of requests

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
