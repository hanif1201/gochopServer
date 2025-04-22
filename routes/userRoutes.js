const express = require("express");
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  addAddress,
  removeAddress,
} = require("../controllers/userController");

const { protect, authorize } = require("../middleware/auth");
const config = require("../config/config");

const router = express.Router();

// Protected routes - all user routes are protected
router.use(protect);

// Admin only routes
router.get("/", authorize(config.roles.ADMIN), getUsers);
router.post("/", authorize(config.roles.ADMIN), createUser);
router.delete("/:id", authorize(config.roles.ADMIN), deleteUser);

// Routes accessible by admin or self (authorization handled in controller)
router.get("/:id", getUser);
router.put("/:id", updateUser);

// Address management for all users
router.post("/addresses", addAddress);
router.delete("/addresses/:id", removeAddress);

module.exports = router;
