const express = require("express");
const {
  getRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  toggleStatus,
  getRestaurantMenu,
  getRestaurantAnalytics,
} = require("../controllers/restaurantController");

const { protect, authorize } = require("../middleware/auth");
const config = require("../config/config");

const router = express.Router();

// Public routes
router.get("/", getRestaurants);
router.get("/:id", getRestaurant);
router.get("/:id/menu", getRestaurantMenu);

// Protected routes
router.post("/", protect, authorize(config.roles.ADMIN), createRestaurant);
router.put(
  "/:id",
  protect,
  authorize(config.roles.ADMIN, config.roles.RESTAURANT),
  updateRestaurant
);
router.delete("/:id", protect, authorize(config.roles.ADMIN), deleteRestaurant);
router.put(
  "/:id/toggle-status",
  protect,
  authorize(config.roles.ADMIN, config.roles.RESTAURANT),
  toggleStatus
);
router.get(
  "/:id/analytics",
  protect,
  authorize(config.roles.ADMIN, config.roles.RESTAURANT),
  getRestaurantAnalytics
);

module.exports = router;
