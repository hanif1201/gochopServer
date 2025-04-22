const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const Order = require("../models/Order");
const Rider = require("../models/Rider");
const MenuItem = require("../models/MenuItem");
const config = require("../config/config");

// @desc    Get dashboard statistics
// @route   GET /api/admin/stats
// @access  Private (Admin)
exports.getDashboardStats = async (req, res, next) => {
  try {
    // Get counts for different entities
    const userCount = await User.countDocuments();
    const customerCount = await User.countDocuments({
      role: config.roles.CUSTOMER,
    });
    const restaurantUserCount = await User.countDocuments({
      role: config.roles.RESTAURANT,
    });
    const riderCount = await User.countDocuments({ role: config.roles.RIDER });
    const adminCount = await User.countDocuments({ role: config.roles.ADMIN });

    const restaurantCount = await Restaurant.countDocuments();
    const menuItemCount = await MenuItem.countDocuments();

    const orderCount = await Order.countDocuments();
    const pendingOrderCount = await Order.countDocuments({
      status: config.orderStatuses.PENDING,
    });
    const processingOrderCount = await Order.countDocuments({
      status: {
        $in: [
          config.orderStatuses.ACCEPTED,
          config.orderStatuses.PREPARING,
          config.orderStatuses.READY_FOR_PICKUP,
          config.orderStatuses.ASSIGNED_TO_RIDER,
          config.orderStatuses.PICKED_UP,
          config.orderStatuses.ON_THE_WAY,
        ],
      },
    });
    const completedOrderCount = await Order.countDocuments({
      status: config.orderStatuses.DELIVERED,
    });
    const cancelledOrderCount = await Order.countDocuments({
      status: config.orderStatuses.CANCELLED,
    });

    // Get active riders
    const activeRiderCount = await Rider.countDocuments({
      status: config.riderStatuses.ONLINE,
      isAvailable: true,
    });

    // Calculate revenue metrics
    const totalRevenue = await calculateTotalRevenue();
    const revenueByDay = await getRevenueByDay();

    // Get top restaurants
    const topRestaurants = await Restaurant.find()
      .sort("-averageRating")
      .limit(5)
      .select("name averageRating ratingCount");

    // Get latest orders
    const latestOrders = await Order.find()
      .sort("-createdAt")
      .limit(10)
      .populate("user restaurant rider", "name email firstName lastName")
      .select("status total createdAt");

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: userCount,
          customers: customerCount,
          restaurants: restaurantUserCount,
          riders: riderCount,
          admins: adminCount,
        },
        restaurants: {
          total: restaurantCount,
          menuItems: menuItemCount,
          top: topRestaurants,
        },
        orders: {
          total: orderCount,
          pending: pendingOrderCount,
          processing: processingOrderCount,
          completed: completedOrderCount,
          cancelled: cancelledOrderCount,
          latest: latestOrders,
        },
        riders: {
          total: riderCount,
          active: activeRiderCount,
        },
        revenue: {
          total: totalRevenue,
          byDay: revenueByDay,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get revenue statistics
// @route   GET /api/admin/revenue
// @access  Private (Admin)
exports.getRevenueStats = async (req, res, next) => {
  try {
    // Get date range from query params
    let { startDate, endDate } = req.query;
    startDate = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
    endDate = endDate ? new Date(endDate) : new Date();

    // End date should be end of the day
    endDate.setHours(23, 59, 59, 999);

    // Get revenue data
    const totalRevenue = await calculateTotalRevenue(startDate, endDate);
    const revenueByDay = await getRevenueByDay(startDate, endDate);
    const revenueByRestaurant = await getRevenueByRestaurant(
      startDate,
      endDate
    );

    // Get platform fee calculation (assuming platform takes a commission)
    const platformFee = totalRevenue * 0.15; // 15% platform fee

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        platformFee,
        revenueByDay,
        revenueByRestaurant,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user statistics
// @route   GET /api/admin/users/stats
// @access  Private (Admin)
exports.getUserStats = async (req, res, next) => {
  try {
    // Get user counts by role
    const userCount = await User.countDocuments();
    const customerCount = await User.countDocuments({
      role: config.roles.CUSTOMER,
    });
    const restaurantUserCount = await User.countDocuments({
      role: config.roles.RESTAURANT,
    });
    const riderCount = await User.countDocuments({ role: config.roles.RIDER });
    const adminCount = await User.countDocuments({ role: config.roles.ADMIN });

    // Get user registration trends
    const registrationTrend = await getUserRegistrationTrend();

    // Get active users (those who placed orders in the last 30 days)
    const activeUsers = await getActiveUsers();

    res.status(200).json({
      success: true,
      data: {
        total: userCount,
        byRole: {
          customers: customerCount,
          restaurants: restaurantUserCount,
          riders: riderCount,
          admins: adminCount,
        },
        registrationTrend,
        activeUsers,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get restaurant statistics
// @route   GET /api/admin/restaurants/stats
// @access  Private (Admin)
exports.getRestaurantStats = async (req, res, next) => {
  try {
    // Get basic stats
    const restaurantCount = await Restaurant.countDocuments();
    const activeRestaurantCount = await Restaurant.countDocuments({
      status: config.restaurantStatuses.OPEN,
    });
    const averageRating = await getAverageRestaurantRating();

    // Get restaurants by rating
    const ratingDistribution = await getRatingDistribution();

    // Get top and bottom restaurants by order volume
    const topRestaurantsByOrders = await getTopRestaurantsByOrders();
    const topRestaurantsByRevenue = await getTopRestaurantsByRevenue();

    res.status(200).json({
      success: true,
      data: {
        total: restaurantCount,
        active: activeRestaurantCount,
        averageRating,
        ratingDistribution,
        topByOrders: topRestaurantsByOrders,
        topByRevenue: topRestaurantsByRevenue,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get order statistics
// @route   GET /api/admin/orders/stats
// @access  Private (Admin)
exports.getOrderStats = async (req, res, next) => {
  try {
    // Get date range from query params
    let { startDate, endDate } = req.query;
    startDate = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
    endDate = endDate ? new Date(endDate) : new Date();

    // End date should be end of the day
    endDate.setHours(23, 59, 59, 999);

    // Get basic stats
    const orderCount = await Order.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Get orders by status
    const ordersByStatus = await getOrdersByStatus(startDate, endDate);

    // Get order trend (orders per day)
    const orderTrend = await getOrderTrend(startDate, endDate);

    // Get average order value
    const averageOrderValue = await getAverageOrderValue(startDate, endDate);

    // Get orders by payment method
    const ordersByPaymentMethod = await getOrdersByPaymentMethod(
      startDate,
      endDate
    );

    // Get cancellation rate
    const cancellationRate = await getCancellationRate(startDate, endDate);

    res.status(200).json({
      success: true,
      data: {
        total: orderCount,
        byStatus: ordersByStatus,
        trend: orderTrend,
        averageOrderValue,
        byPaymentMethod: ordersByPaymentMethod,
        cancellationRate,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get rider statistics
// @route   GET /api/admin/riders/stats
// @access  Private (Admin)
exports.getRiderStats = async (req, res, next) => {
  try {
    // Get basic stats
    const riderCount = await Rider.countDocuments();
    const activeRiderCount = await Rider.countDocuments({
      status: config.riderStatuses.ONLINE,
      isAvailable: true,
    });

    // Get riders by status
    const ridersByStatus = await getRidersByStatus();

    // Get top riders by deliveries and ratings
    const topRidersByDeliveries = await getTopRidersByDeliveries();
    const topRidersByRating = await getTopRidersByRating();

    // Get average delivery time
    const averageDeliveryTime = await getAverageDeliveryTime();

    res.status(200).json({
      success: true,
      data: {
        total: riderCount,
        active: activeRiderCount,
        byStatus: ridersByStatus,
        topByDeliveries: topRidersByDeliveries,
        topByRating: topRidersByRating,
        averageDeliveryTime,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Helper functions for data aggregation

async function calculateTotalRevenue(startDate, endDate) {
  const matchStage = {};

  if (startDate && endDate) {
    matchStage.createdAt = { $gte: startDate, $lte: endDate };
  }

  matchStage.status = config.orderStatuses.DELIVERED;

  const result = await Order.aggregate([
    { $match: matchStage },
    { $group: { _id: null, total: { $sum: "$total" } } },
  ]);

  return result.length > 0 ? result[0].total : 0;
}

async function getRevenueByDay(startDate, endDate) {
  const matchStage = {};

  if (startDate && endDate) {
    matchStage.createdAt = { $gte: startDate, $lte: endDate };
  }

  matchStage.status = config.orderStatuses.DELIVERED;

  const result = await Order.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        totalRevenue: { $sum: "$total" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return result.map((item) => ({
    date: item._id,
    revenue: item.totalRevenue,
    orderCount: item.count,
  }));
}

async function getRevenueByRestaurant(startDate, endDate) {
  const matchStage = {};

  if (startDate && endDate) {
    matchStage.createdAt = { $gte: startDate, $lte: endDate };
  }

  matchStage.status = config.orderStatuses.DELIVERED;

  const result = await Order.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$restaurant",
        totalRevenue: { $sum: "$total" },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 },
  ]);

  // Populate restaurant details
  const populatedResult = [];
  for (const item of result) {
    const restaurant = await Restaurant.findById(item._id).select("name");
    if (restaurant) {
      populatedResult.push({
        restaurant: restaurant.name,
        restaurantId: item._id,
        revenue: item.totalRevenue,
        orderCount: item.count,
      });
    }
  }

  return populatedResult;
}

async function getUserRegistrationTrend() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await User.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return result.map((item) => ({
    date: item._id,
    newUsers: item.count,
  }));
}

async function getActiveUsers() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await Order.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: "$user" } },
    { $count: "activeUsers" },
  ]);

  return result.length > 0 ? result[0].activeUsers : 0;
}

async function getAverageRestaurantRating() {
  const result = await Restaurant.aggregate([
    { $match: { averageRating: { $gt: 0 } } },
    { $group: { _id: null, averageRating: { $avg: "$averageRating" } } },
  ]);

  return result.length > 0 ? result[0].averageRating : 0;
}

async function getRatingDistribution() {
  const result = [];

  for (let i = 1; i <= 5; i++) {
    const count = await Restaurant.countDocuments({
      averageRating: { $gte: i, $lt: i + 1 },
    });

    result.push({ rating: i, count });
  }

  return result;
}

async function getTopRestaurantsByOrders() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await Order.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: "$restaurant", orderCount: { $sum: 1 } } },
    { $sort: { orderCount: -1 } },
    { $limit: 10 },
  ]);

  // Populate restaurant details
  const populatedResult = [];
  for (const item of result) {
    const restaurant = await Restaurant.findById(item._id).select("name");
    if (restaurant) {
      populatedResult.push({
        restaurant: restaurant.name,
        restaurantId: item._id,
        orderCount: item.orderCount,
      });
    }
  }

  return populatedResult;
}

async function getTopRestaurantsByRevenue() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo },
        status: config.orderStatuses.DELIVERED,
      },
    },
    { $group: { _id: "$restaurant", revenue: { $sum: "$total" } } },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
  ]);

  // Populate restaurant details
  const populatedResult = [];
  for (const item of result) {
    const restaurant = await Restaurant.findById(item._id).select("name");
    if (restaurant) {
      populatedResult.push({
        restaurant: restaurant.name,
        restaurantId: item._id,
        revenue: item.revenue,
      });
    }
  }

  return populatedResult;
}

async function getOrdersByStatus(startDate, endDate) {
  const result = [];

  const matchStage = {};
  if (startDate && endDate) {
    matchStage.createdAt = { $gte: startDate, $lte: endDate };
  }

  for (const status of Object.values(config.orderStatuses)) {
    const count = await Order.countDocuments({
      ...matchStage,
      status,
    });

    result.push({ status, count });
  }

  return result;
}

async function getOrderTrend(startDate, endDate) {
  const result = await Order.aggregate([
    { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return result.map((item) => ({
    date: item._id,
    orderCount: item.count,
  }));
}

async function getAverageOrderValue(startDate, endDate) {
  const matchStage = {};

  if (startDate && endDate) {
    matchStage.createdAt = { $gte: startDate, $lte: endDate };
  }

  const result = await Order.aggregate([
    { $match: matchStage },
    { $group: { _id: null, averageValue: { $avg: "$total" } } },
  ]);

  return result.length > 0 ? result[0].averageValue : 0;
}

async function getOrdersByPaymentMethod(startDate, endDate) {
  const matchStage = {};

  if (startDate && endDate) {
    matchStage.createdAt = { $gte: startDate, $lte: endDate };
  }

  const result = await Order.aggregate([
    { $match: matchStage },
    { $group: { _id: "$paymentMethod", count: { $sum: 1 } } },
  ]);

  return result.map((item) => ({
    paymentMethod: item._id,
    count: item.count,
  }));
}

async function getCancellationRate(startDate, endDate) {
  const matchStage = {};

  if (startDate && endDate) {
    matchStage.createdAt = { $gte: startDate, $lte: endDate };
  }

  const totalOrders = await Order.countDocuments(matchStage);
  const cancelledOrders = await Order.countDocuments({
    ...matchStage,
    status: config.orderStatuses.CANCELLED,
  });

  return totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
}

async function getRidersByStatus() {
  const result = [];

  for (const status of Object.values(config.riderStatuses)) {
    const count = await Rider.countDocuments({ status });
    result.push({ status, count });
  }

  return result;
}

async function getTopRidersByDeliveries() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo },
        status: config.orderStatuses.DELIVERED,
        rider: { $ne: null },
      },
    },
    { $group: { _id: "$rider", deliveryCount: { $sum: 1 } } },
    { $sort: { deliveryCount: -1 } },
    { $limit: 10 },
  ]);

  // Populate rider details
  const populatedResult = [];
  for (const item of result) {
    const rider = await Rider.findById(item._id).populate("user", "name");

    if (rider) {
      populatedResult.push({
        rider: rider.user
          ? rider.user.name
          : `${rider.firstName} ${rider.lastName}`,
        riderId: item._id,
        deliveryCount: item.deliveryCount,
      });
    }
  }

  return populatedResult;
}

async function getTopRidersByRating() {
  const result = await Rider.find({
    averageRating: { $gt: 0 },
    numberOfRatings: { $gt: 5 }, // Minimum number of ratings to be considered
  })
    .sort("-averageRating")
    .limit(10)
    .populate("user", "name")
    .select("firstName lastName averageRating numberOfRatings");

  return result.map((rider) => ({
    rider: rider.user
      ? rider.user.name
      : `${rider.firstName} ${rider.lastName}`,
    riderId: rider._id,
    averageRating: rider.averageRating,
    numberOfRatings: rider.numberOfRatings,
  }));
}

async function getAverageDeliveryTime() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const deliveredOrders = await Order.find({
    status: config.orderStatuses.DELIVERED,
    createdAt: { $gte: thirtyDaysAgo },
    actualDeliveryTime: { $exists: true },
  });

  if (deliveredOrders.length === 0) {
    return 0;
  }

  let totalDeliveryTime = 0;

  for (const order of deliveredOrders) {
    const deliveryTime =
      (new Date(order.actualDeliveryTime) - new Date(order.createdAt)) /
      (1000 * 60); // Convert to minutes
    totalDeliveryTime += deliveryTime;
  }

  return totalDeliveryTime / deliveredOrders.length;
}
