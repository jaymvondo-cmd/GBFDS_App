const express = require("express");
const {
    showAlerts,
    showAlertDetail,
    updateAlert,
    showTransactions,
    showTransactionDetail,
    showGraph,
    getGraphJson,
    getAccountJson,
} = require("../controller/analyst.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const router = express.Router();

// Both roles can view fraud data; only these pages are the analyst's
// day-to-day workspace. Admins can see them too (useful for oversight).
router.get("/alerts", requireAuth, showAlerts);
router.get("/alerts/:id", requireAuth, showAlertDetail);
router.post("/alerts/:id", requireAuth, updateAlert);

router.get("/transactions", requireAuth, showTransactions);
router.get("/transactions/:id", requireAuth, showTransactionDetail);

router.get("/graph", requireAuth, showGraph);
router.get("/api/graph", requireAuth, getGraphJson);
router.get("/api/accounts/:id", requireAuth, getAccountJson);

module.exports = router;
