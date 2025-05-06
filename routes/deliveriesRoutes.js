const express = require("express");
const deliveryController = require("../controllers/deliveryController");
const { protect, authorize } = require("../middleware/auth");
const config = require("../config/config");

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get available orders for the rider
router.get("/available", deliveryController.getAvailableDeliveries);
// Get the rider's current active delivery
router.get("/active", deliveryController.getActiveDelivery);
// Get the rider's delivery history
router.get("/history", deliveryController.getDeliveryHistory);
// Get detailed information about a specific delivery
router.get("/:deliveryId", deliveryController.getDeliveryDetails);
// Accept a delivery assignment
router.post("/:deliveryId/accept", deliveryController.acceptDelivery);
// Reject a delivery assignment
router.post("/:deliveryId/reject", deliveryController.rejectDelivery);
// Mark the delivery as picked up from the restaurant
router.post("/:deliveryId/pickup", deliveryController.pickupDelivery);
// Mark the delivery as delivered to the customer
router.post("/:deliveryId/complete", deliveryController.completeDelivery);
// Report an issue with the delivery
router.post("/:deliveryId/issue", deliveryController.reportDeliveryIssue);

module.exports = router;
