const Order = require("../models/Order");
const Rider = require("../models/Rider");
const mongoose = require("mongoose");

// Get available orders for the rider
exports.getAvailableDeliveries = async (req, res) => {
  // For demo: return all orders with status 'ready_for_pickup' and no assigned rider
  const orders = await Order.find({ status: "ready_for_pickup", rider: null });
  res.json(orders);
};

// Get the rider's current active delivery
exports.getActiveDelivery = async (req, res) => {
  const riderId = req.user.id;
  const order = await Order.findOne({
    rider: riderId,
    status: { $in: ["accepted", "preparing", "ready_for_pickup"] },
  });
  if (!order) return res.status(404).json({ message: "No active delivery" });
  res.json(order);
};

// Get the rider's delivery history
exports.getDeliveryHistory = async (req, res) => {
  const riderId = req.user.id;
  const { page = 1, limit = 10 } = req.query;
  const orders = await Order.find({
    rider: riderId,
    status: { $in: ["delivered", "cancelled"] },
  })
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .sort({ createdAt: -1 });
  res.json(orders);
};

// Get detailed information about a specific delivery
exports.getDeliveryDetails = async (req, res) => {
  const { deliveryId } = req.params;
  const order = await Order.findById(deliveryId);
  if (!order) return res.status(404).json({ message: "Delivery not found" });
  res.json(order);
};

// Accept a delivery assignment
exports.acceptDelivery = async (req, res) => {
  const { deliveryId } = req.params;
  const riderId = req.user.id;
  const order = await Order.findOneAndUpdate(
    { _id: deliveryId, status: "ready_for_pickup", rider: null },
    { rider: riderId, status: "accepted" },
    { new: true }
  );
  if (!order)
    return res.status(400).json({ message: "Cannot accept delivery" });
  res.json(order);
};

// Reject a delivery assignment
exports.rejectDelivery = async (req, res) => {
  const { deliveryId } = req.params;
  const { reason } = req.body;
  // For demo: just return success
  res.json({
    message: `Delivery ${deliveryId} rejected for reason: ${reason}`,
  });
};

// Mark the delivery as picked up from the restaurant
exports.pickupDelivery = async (req, res) => {
  const { deliveryId } = req.params;
  const order = await Order.findByIdAndUpdate(
    deliveryId,
    { status: "preparing" },
    { new: true }
  );
  if (!order) return res.status(404).json({ message: "Delivery not found" });
  res.json(order);
};

// Mark the delivery as delivered to the customer
exports.completeDelivery = async (req, res) => {
  const { deliveryId } = req.params;
  // For demo: just mark as delivered
  const order = await Order.findByIdAndUpdate(
    deliveryId,
    { status: "delivered", actualDeliveryTime: new Date() },
    { new: true }
  );
  if (!order) return res.status(404).json({ message: "Delivery not found" });
  res.json(order);
};

// Report an issue with the delivery
exports.reportDeliveryIssue = async (req, res) => {
  const { deliveryId } = req.params;
  const { issueType, description } = req.body;
  // For demo: just return success
  res.json({
    message: `Issue reported for delivery ${deliveryId}: ${issueType} - ${description}`,
  });
};
