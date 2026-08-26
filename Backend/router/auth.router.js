const express = require("express");
const { login, logout } = require("../controller/auth.controller");

const router = express.Router();

router.post("/login", login);
router.post("/logout", logout);

module.exports = router;
