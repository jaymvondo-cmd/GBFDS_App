const express = require("express");
const { getStats } = require("../controller/dashboard.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/stats", requireAuth, getStats);

module.exports = router;
