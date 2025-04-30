const express = require("express");
const {
  getOrders,
  getMyOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  rateOrder,
} = require("../controllers/orderController");

const { protect, authorize } = require("../middleware/auth");
const config = require("../config/config");

const router = express.Router();

// Protected routes
router.use(protect); // All order routes are protected

// Admin only routes
router.get(
  "/",
  authorize(config.roles.ADMIN, config.roles.RESTAURANT),
  getOrders
);

// Routes for all authenticated users
router.get("/myorders", getMyOrders);
router.get("/:id", getOrder);

// Customer only routes
router.post("/", authorize(config.roles.CUSTOMER), createOrder);
router.post("/:id/rate", authorize(config.roles.CUSTOMER), rateOrder);

// Status update routes
router.put(
  "/:id/status",
  authorize(config.roles.ADMIN, config.roles.RESTAURANT),
  updateOrderStatus
);

module.exports = router;
