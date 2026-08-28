const express = require("express");
const { listRules, createRule, updateRule, deleteRule } = require("../controller/rule.controller");
const { verifyToken, requireRole } = require("../middleware/jwt.middleware");

const router = express.Router();

// Every route here is System Admin only — see apiUser.router.js for why
// this uses per-route middleware instead of a blanket router.use().
router.get("/rules", verifyToken, requireRole("admin"), listRules);
router.post("/rules", verifyToken, requireRole("admin"), createRule);
router.put("/rules/:id", verifyToken, requireRole("admin"), updateRule);
router.delete("/rules/:id", verifyToken, requireRole("admin"), deleteRule);

module.exports = router;
