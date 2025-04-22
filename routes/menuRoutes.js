const express = require("express");
const {
  getMenuItems,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
} = require("../controllers/menuController");

const { protect, authorize } = require("../middleware/auth");
const config = require("../config/config");

const router = express.Router();

// Public routes
router.get("/", getMenuItems);
router.get("/:id", getMenuItem);

// Protected routes
router.post(
  "/",
  protect,
  authorize(config.roles.ADMIN, config.roles.RESTAURANT),
  createMenuItem
);
router.put(
  "/:id",
  protect,
  authorize(config.roles.ADMIN, config.roles.RESTAURANT),
  updateMenuItem
);
router.delete(
  "/:id",
  protect,
  authorize(config.roles.ADMIN, config.roles.RESTAURANT),
  deleteMenuItem
);
router.put(
  "/:id/toggle-availability",
  protect,
  authorize(config.roles.ADMIN, config.roles.RESTAURANT),
  toggleAvailability
);

module.exports = router;
