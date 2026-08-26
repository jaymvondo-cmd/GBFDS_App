const express = require("express");
const { showPortalSelect, showLogin } = require("../controller/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", (req, res) => {
    res.redirect(req.session && req.session.user ? "/dashboard" : "/login");
});

router.get("/login", showPortalSelect);
router.get("/login/:portal", showLogin);

router.get("/dashboard", requireAuth, (req, res) => {
    res.render("dashboard/placeholder", { user: req.session.user });
});

module.exports = router;
