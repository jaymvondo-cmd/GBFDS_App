const express = require("express");
const { getStats, getFraudStats } = require("../controller/dashboard.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/stats", requireAuth, getStats);
router.get("/fraud-stats", requireAuth, getFraudStats);

module.exports = router;
