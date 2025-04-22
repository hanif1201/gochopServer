const express = require("express");
const {
  getDashboardStats,
  getRevenueStats,
  getUserStats,
  getRestaurantStats,
  getOrderStats,
  getRiderStats,
} = require("../controllers/adminController");

const { protect, authorize } = require("../middleware/auth");
const config = require("../config/config");

const router = express.Router();

// All routes are protected and admin only
router.use(protect);
router.use(authorize(config.roles.ADMIN));

// Dashboard and statistics routes
router.get("/stats", getDashboardStats);
router.get("/revenue", getRevenueStats);
router.get("/users/stats", getUserStats);
router.get("/restaurants/stats", getRestaurantStats);
router.get("/orders/stats", getOrderStats);
router.get("/riders/stats", getRiderStats);

module.exports = router;
