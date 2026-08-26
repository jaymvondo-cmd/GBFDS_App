const express = require("express");
const { showLogin, showSignup } = require("../controller/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", (req, res) => {
    res.redirect(req.session && req.session.user ? "/dashboard" : "/login");
});

router.get("/login", showLogin);
router.get("/signup", showSignup);

router.get("/dashboard", requireAuth, (req, res) => {
    res.render("dashboard/placeholder", { user: req.session.user });
});

module.exports = router;
