const express = require("express");
const { listUsers, createUser, updateUser, deleteUser } = require("../controller/apiUser.controller");
const { verifyToken, requireRole } = require("../middleware/jwt.middleware");

const router = express.Router();

// Every route here is System Admin only. Middleware is listed per-route
// (not with a blanket router.use()) — this router shares the "/api"
// mount point with several others, and a path-less router.use() would
// intercept requests for THEIR routes too (e.g. /api/health), not just
// this router's own /users routes.
router.get("/users", verifyToken, requireRole("admin"), listUsers);
router.post("/users", verifyToken, requireRole("admin"), createUser);
router.put("/users/:id", verifyToken, requireRole("admin"), updateUser);
router.delete("/users/:id", verifyToken, requireRole("admin"), deleteUser);

module.exports = router;
