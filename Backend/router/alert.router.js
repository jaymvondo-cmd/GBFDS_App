const express = require("express");
const { listAlerts, getAlert, updateAlert } = require("../controller/alert.controller");
const { verifyToken } = require("../middleware/jwt.middleware");

const router = express.Router();

// Per-route middleware (not router.use()) — see apiUser.router.js for
// why: this router shares the "/api" mount point with several others.
router.get("/alerts", verifyToken, listAlerts);
router.get("/alerts/:id", verifyToken, getAlert);
router.put("/alerts/:id", verifyToken, updateAlert);

module.exports = router;
