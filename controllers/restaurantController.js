const Restaurant = require("../models/Restaurant");
const User = require("../models/User");
const MenuItem = require("../models/MenuItem");
const config = require("../config/config");
const geocoder = require("../utils/geocoder");
const Order = require("../models/Order");
const mongoose = require("mongoose");

// @desc    Get all restaurants with filtering and pagination
// @route   GET /api/restaurants
// @access  Public
exports.getRestaurants = async (req, res, next) => {
  try {
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = [
      "select",
      "sort",
      "page",
      "limit",
      "near",
      "distance",
      "cuisine",
    ];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach((param) => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    // Finding resource
    let query = Restaurant.find(JSON.parse(queryStr)).populate(
      "user",
      "name email"
    );

    // Filtering by location
    if (req.query.near) {
      const [lat, lng] = req.query.near.split(",");
      const distance = parseInt(req.query.distance, 10) || 10; // Default 10km

      if (!isNaN(lat) && !isNaN(lng)) {
        query = Restaurant.find({
          location: {
            $geoWithin: {
              $centerSphere: [
                [parseFloat(lng), parseFloat(lat)],
                distance / 6378.1,
              ],
            },
          },
        });
      }
    }

    // Filtering by cuisine
    if (req.query.cuisine) {
      const cuisines = req.query.cuisine.split(",");
      query = query.find({ cuisineType: { $in: cuisines } });
    }

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(",").join(" ");
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-averageRating");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || config.pagination.defaultPage;
    const limit =
      parseInt(req.query.limit, 10) || config.pagination.defaultLimit;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Restaurant.countDocuments();

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const restaurants = await query;

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit,
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      };
    }

    res.status(200).json({
      success: true,
      count: restaurants.length,
      pagination,
      data: restaurants,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single restaurant
// @route   GET /api/restaurants/:id
// @access  Public
exports.getRestaurant = async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id)
      .populate("user", "name email")
      .populate({
        path: "menuItems",
        select: "name description price image category featured available",
      });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    res.status(200).json({
      success: true,
      data: restaurant,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new restaurant
// @route   POST /api/restaurants
// @access  Private (admin only)
exports.createRestaurant = async (req, res, next) => {
  try {
    // Handle user association
    let user;

    // If creating a restaurant with an existing user ID
    if (req.body.userId) {
      user = await User.findById(req.body.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Update user role to restaurant
      user.role = config.roles.RESTAURANT;
      await user.save();
    }
    // If creating a new user with the restaurant
    else if (req.body.user) {
      const { name, email, phone, password } = req.body.user;

      // Check if email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already registered",
        });
      }

      // Create user with restaurant role
      user = await User.create({
        name,
        email,
        phone,
        password,
        role: config.roles.RESTAURANT,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "User information is required",
      });
    }

    // Process geocoding if address is provided
    if (req.body.address) {
      const loc = await geocoder.geocode(req.body.address);

      if (loc && loc.length > 0) {
        req.body.location = {
          type: "Point",
          coordinates: [loc[0].longitude, loc[0].latitude],
          formattedAddress: loc[0].formattedAddress,
          city: loc[0].city,
          state: loc[0].stateCode,
          zipcode: loc[0].zipcode,
          country: loc[0].countryCode,
        };
      }
    }

    // Create restaurant with user association
    req.body.user = user._id;
    const restaurant = await Restaurant.create(req.body);

    res.status(201).json({
      success: true,
      data: restaurant,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update restaurant
// @route   PUT /api/restaurants/:id
// @access  Private (restaurant owner or admin)
exports.updateRestaurant = async (req, res, next) => {
  try {
    let restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Check ownership
    if (
      restaurant.user.toString() !== req.user.id &&
      req.user.role !== config.roles.ADMIN
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this restaurant",
      });
    }

    // Process geocoding if address is updated
    if (req.body.address) {
      const loc = await geocoder.geocode(req.body.address);

      if (loc && loc.length > 0) {
        req.body.location = {
          type: "Point",
          coordinates: [loc[0].longitude, loc[0].latitude],
          formattedAddress: loc[0].formattedAddress,
          city: loc[0].city,
          state: loc[0].stateCode,
          zipcode: loc[0].zipcode,
          country: loc[0].countryCode,
        };
      }
    }

    restaurant = await Restaurant.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: restaurant,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete restaurant
// @route   DELETE /api/restaurants/:id
// @access  Private (admin only)
exports.deleteRestaurant = async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Check if admin
    if (req.user.role !== config.roles.ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete restaurants",
      });
    }

    // Delete related menu items
    await MenuItem.deleteMany({ restaurant: req.params.id });

    // Delete restaurant
    await restaurant.remove();

    // Update user role if needed
    const user = await User.findById(restaurant.user);
    if (user) {
      user.role = config.roles.CUSTOMER;
      await user.save();
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle restaurant status (open/closed)
// @route   PUT /api/restaurants/:id/toggle-status
// @access  Private (restaurant owner or admin)
exports.toggleStatus = async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Check ownership
    if (
      restaurant.user.toString() !== req.user.id &&
      req.user.role !== config.roles.ADMIN
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this restaurant",
      });
    }

    // Toggle status
    const newStatus =
      restaurant.status === config.restaurantStatuses.OPEN
        ? config.restaurantStatuses.CLOSED
        : config.restaurantStatuses.OPEN;

    restaurant.status = newStatus;
    await restaurant.save();

    res.status(200).json({
      success: true,
      data: restaurant,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get menu items for a restaurant
// @route   GET /api/restaurants/:id/menu
// @access  Public
exports.getRestaurantMenu = async (req, res, next) => {
  try {
    const menuItems = await MenuItem.find({ restaurant: req.params.id });

    res.status(200).json({
      success: true,
      count: menuItems.length,
      data: menuItems,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get restaurant analytics
// @route   GET /api/restaurants/:id/analytics
// @access  Private (restaurant owner or admin)
exports.getRestaurantAnalytics = async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Check ownership
    if (
      restaurant.user.toString() !== req.user.id &&
      req.user.role !== config.roles.ADMIN
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view these analytics",
      });
    }

    const period = req.query.period || "30days";
    let startDate = new Date();

    switch (period) {
      case "week":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "month":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "year":
        startDate.setDate(startDate.getDate() - 365);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get orders for the period
    const orders = await Order.find({
      restaurant: req.params.id,
      createdAt: { $gte: startDate },
    }).sort("createdAt");

    // Get top selling items
    const topItems = await MenuItem.aggregate([
      {
        $match: { restaurant: mongoose.Types.ObjectId(req.params.id) },
      },
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "items.menuItem",
          as: "orders",
        },
      },
      {
        $project: {
          name: 1,
          price: 1,
          orderCount: { $size: "$orders" },
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: 5 },
    ]);

    // Calculate daily sales
    const salesByDay = [];
    let currentDate = new Date(startDate);

    while (currentDate <= new Date()) {
      const dayStart = new Date(currentDate.setHours(0, 0, 0, 0));
      const dayEnd = new Date(currentDate.setHours(23, 59, 59, 999));

      const dayOrders = orders.filter(
        (order) => order.createdAt >= dayStart && order.createdAt <= dayEnd
      );

      salesByDay.push({
        date: dayStart.toISOString().split("T")[0],
        revenue: dayOrders.reduce((sum, order) => sum + order.total, 0),
        orderCount: dayOrders.length,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate totals
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = orders.length;

    res.status(200).json({
      success: true,
      data: {
        salesByDay,
        topItems,
        totalRevenue,
        totalOrders,
      },
    });
  } catch (err) {
    next(err);
  }
};
