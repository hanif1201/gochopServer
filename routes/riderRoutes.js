const express = require("express");
const {
  getRiders,
  getRider,
  getMyProfile,
  createRider,
  updateRider,
  deleteRider,
  updateStatus,
  updateLocation,
  getEarnings,
} = require("../controllers/riderController");

const { protect, authorize } = require("../middleware/auth");
const config = require("../config/config");

const router = express.Router();

// Public routes - none

// Protected routes
router.use(protect);

// Routes for admin
router.get("/", authorize(config.roles.ADMIN), getRiders);
router.delete("/:id", authorize(config.roles.ADMIN), deleteRider);

// Routes for creating rider profiles
router.post(
  "/",
  authorize(config.roles.ADMIN, config.roles.CUSTOMER),
  createRider
);

// Routes for riders
router.get("/me", authorize(config.roles.RIDER), getMyProfile);
router.get("/earnings", authorize(config.roles.RIDER), getEarnings);
router.put("/status", authorize(config.roles.RIDER), updateStatus);
router.put("/location", authorize(config.roles.RIDER), updateLocation);

// Routes accessible by admin or self
router.get("/:id", authorize(config.roles.ADMIN, config.roles.RIDER), getRider);
router.put(
  "/:id",
  authorize(config.roles.ADMIN, config.roles.RIDER),
  updateRider
);

module.exports = router;
