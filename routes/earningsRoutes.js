const express = require("express");
const earningsController = require("../controllers/earningsController");
const { protect } = require("../middleware/auth");

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get a summary of the rider's earnings
router.get("/", earningsController.getEarningsSummary);
// Get detailed earnings history
router.get("/history", earningsController.getEarningsHistory);

module.exports = router;
