const express = require("express");
const {
    createTransaction,
    listTransactions,
    getTransaction,
    detectTransaction,
} = require("../controller/transaction.controller");
const { verifyToken } = require("../middleware/jwt.middleware");

const router = express.Router();

// Per-route middleware (not router.use()) — see apiUser.router.js for
// why: this router shares the "/api" mount point with several others.
router.post("/transactions", verifyToken, createTransaction);
router.get("/transactions", verifyToken, listTransactions);
router.get("/transactions/:id", verifyToken, getTransaction);
router.post("/detect", verifyToken, detectTransaction);

module.exports = router;
