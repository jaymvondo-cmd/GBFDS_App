const express = require("express");
const { getAuditLogs, getHealth } = require("../controller/system.controller");
const { verifyToken, requireRole } = require("../middleware/jwt.middleware");

const router = express.Router();

router.get("/audit-logs", verifyToken, requireRole("admin"), getAuditLogs);
router.get("/health", verifyToken, getHealth);

module.exports = router;
