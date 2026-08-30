const express = require("express");
const {
    listUsers,
    showCreateForm,
    createUser,
    showEditForm,
    updateUser,
    deleteUser,
} = require("../controller/user.controller");
const {
    showRules,
    showRuleForm,
    showRuleEditForm,
    createRule,
    updateRule,
    toggleRule,
    deleteRule,
    updateThreshold,
    showSystemHealth,
    showAuditLogs,
} = require("../controller/adminSystem.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

// This router is mounted at "/admin" and every page under it is
// admin-only, so a router-level guard is correct here.
router.use(requireAuth, requireRole("admin"));

// User account management
router.get("/users", listUsers);
router.get("/users/new", showCreateForm);
router.post("/users", createUser);
router.get("/users/:id/edit", showEditForm);
router.post("/users/:id", updateUser);
router.post("/users/:id/delete", deleteUser);

// Detection rules + global threshold
router.get("/rules", showRules);
router.get("/rules/new", showRuleForm);
router.post("/rules", createRule);
router.post("/rules/threshold", updateThreshold);
router.get("/rules/:id/edit", showRuleEditForm);
router.post("/rules/:id", updateRule);
router.post("/rules/:id/toggle", toggleRule);
router.post("/rules/:id/delete", deleteRule);

// System monitoring
router.get("/system", showSystemHealth);
router.get("/audit", showAuditLogs);

module.exports = router;
