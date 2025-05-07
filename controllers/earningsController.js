const Order = require("../models/Order");
const Rider = require("../models/Rider");

// Get a summary of the rider's earnings
exports.getEarningsSummary = async (req, res) => {
  const riderId = req.user.id;
  // Get all delivered orders for this rider
  const deliveredOrders = await Order.find({
    rider: riderId,
    status: "delivered",
  });

  // Log delivered orders
  console.log("\n--- [SERVER] Delivered Orders for Rider ---");
  deliveredOrders.forEach((order) => {
    console.log({
      _id: order._id,
      actualDeliveryTime: order.actualDeliveryTime,
      deliveryFee: order.deliveryFee,
      total: order.total,
      createdAt: order.createdAt,
      items: order.items,
    });
  });

  const totalEarnings = deliveredOrders.reduce(
    (sum, order) => sum + (order.deliveryFee || 0),
    0
  );
  const totalDeliveries = deliveredOrders.length;

  // Calculate total hours worked (sum of delivery durations in hours)
  let totalMinutes = 0;
  deliveredOrders.forEach((order) => {
    if (order.createdAt && order.actualDeliveryTime) {
      totalMinutes +=
        (order.actualDeliveryTime - order.createdAt) / (1000 * 60);
    }
  });
  const totalHours = totalMinutes / 60;

  // Calculate average earning per delivery
  const averageEarning =
    totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0;

  // Delivery earnings (sum of deliveryFee)
  const deliveryEarnings = totalEarnings;

  // Tips and bonuses (if not available, set to 0)
  const tips = deliveredOrders.reduce(
    (sum, order) => sum + (order.tip || 0),
    0
  );
  const bonuses = deliveredOrders.reduce(
    (sum, order) => sum + (order.bonus || 0),
    0
  );

  // Log expected earnings summary
  console.log("\n--- [SERVER] Expected Earnings Summary ---");
  console.log({
    totalEarnings,
    totalDeliveries,
    averageEarning,
    totalHours,
    deliveryEarnings,
    tips,
    bonuses,
  });

  res.json({
    totalEarnings,
    totalDeliveries,
    averageEarning,
    totalHours,
    deliveryEarnings,
    tips,
    bonuses,
  });
};

// Get detailed earnings history
exports.getEarningsHistory = async (req, res) => {
  const riderId = req.user.id;
  const { startDate, endDate, page = 1, limit = 10 } = req.query;
  const query = { rider: riderId, status: "delivered" };
  if (startDate && endDate) {
    query.actualDeliveryTime = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }
  console.log("[EARNINGS HISTORY] riderId:", riderId);
  console.log("[EARNINGS HISTORY] query:", query);
  const orders = await Order.find(query)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .sort({ actualDeliveryTime: -1 });
  console.log("[EARNINGS HISTORY] orders count:", orders.length);
  res.json(orders);
};
