const express = require("express");
const { login } = require("../controller/mobileAuth.controller");

const router = express.Router();

router.post("/login", login);

module.exports = router;
