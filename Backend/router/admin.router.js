const express = require("express");
const {
    listUsers,
    showCreateForm,
    createUser,
    showEditForm,
    updateUser,
    deleteUser,
} = require("../controller/user.controller");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(requireAuth, requireRole("admin"));

router.get("/users", listUsers);
router.get("/users/new", showCreateForm);
router.post("/users", createUser);
router.get("/users/:id/edit", showEditForm);
router.post("/users/:id", updateUser);
router.post("/users/:id/delete", deleteUser);

module.exports = router;
