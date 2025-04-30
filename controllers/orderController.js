const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const Restaurant = require("../models/Restaurant");
const User = require("../models/User");
const Rider = require("../models/Rider");
const config = require("../config/config");
const notifications = require("../utils/notifications");
const geocoder = require("../utils/geocoder");
const paymentGateway = require("../utils/paymentGateway");

// Add this at the top of the file to help debug
const controllerExports = {
  getOrders: true,
  getMyOrders: true,
  getOrder: true,
  createOrder: true,
  updateOrderStatus: true,
  rateOrder: true,
};

Object.keys(controllerExports).forEach((key) => {
  if (!exports[key]) {
    console.error(`Missing controller export: ${key}`);
  }
});

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private (Admin & Restaurant)
exports.getOrders = async (req, res, next) => {
  try {
    let query = {};

    // If restaurant user, only show their orders
    if (req.user.role === config.roles.RESTAURANT) {
      const restaurant = await Restaurant.findOne({ user: req.user._id });
      console.log("Found restaurant:", restaurant?._id);
      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: "Restaurant not found",
        });
      }
      query.restaurant = restaurant._id;
    }

    // Add any additional filters from query params
    if (req.query.status) {
      query.status = req.query.status;
    }

    console.log("Order query:", query);

    const orders = await Order.find(query)
      .sort("-createdAt")
      .populate("user", "name email")
      .populate("restaurant", "name");

    console.log(
      "Order statuses in DB:",
      orders.map((o) => ({
        id: o._id,
        status: o.status,
        createdAt: o.createdAt,
      }))
    );

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get orders for the current user
// @route   GET /api/orders/myorders
// @access  Private
exports.getMyOrders = async (req, res, next) => {
  try {
    let query;

    // Based on user role, get different orders
    if (req.user.role === config.roles.CUSTOMER) {
      // Customers see their own orders
      query = Order.find({ user: req.user.id }).sort("-createdAt");
    } else if (req.user.role === config.roles.RESTAURANT) {
      // Restaurants see orders for their restaurant
      const restaurants = await Restaurant.find({ user: req.user.id });
      const restaurantIds = restaurants.map((r) => r._id);
      query = Order.find({ restaurant: { $in: restaurantIds } }).sort(
        "-createdAt"
      );
    } else if (req.user.role === config.roles.RIDER) {
      // Riders see orders assigned to them
      const rider = await Rider.findOne({ user: req.user.id });
      if (!rider) {
        return res.status(404).json({
          success: false,
          message: "Rider profile not found",
        });
      }
      query = Order.find({ rider: rider._id }).sort("-createdAt");
    } else if (req.user.role === config.roles.ADMIN) {
      // Admins see all orders
      query = Order.find().sort("-createdAt");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || config.pagination.defaultPage;
    const limit =
      parseInt(req.query.limit, 10) || config.pagination.defaultLimit;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await query.clone().countDocuments();

    query = query.skip(startIndex).limit(limit);

    // Populate with related data
    query = query.populate([
      { path: "user", select: "name email phone" },
      { path: "restaurant", select: "name address phone" },
      { path: "rider", select: "firstName lastName phone" },
      { path: "items.menuItem", select: "name price image" },
    ]);

    // Executing query
    const orders = await query;

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
      count: orders.length,
      pagination,
      data: orders,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res, next) => {
  try {
    console.log("Getting order:", req.params.id);

    const order = await Order.findById(req.params.id)
      .populate("user", "name email phone")
      .populate("restaurant", "name")
      .populate("items.menuItem", "name price image");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user has access to this order
    if (req.user.role === config.roles.RESTAURANT) {
      const restaurant = await Restaurant.findOne({ user: req.user._id });
      if (
        !restaurant ||
        order.restaurant._id.toString() !== restaurant._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this order",
        });
      }
    }

    console.log("Returning order data");
    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (err) {
    console.error("Error in getOrder:", err);
    next(err);
  }
};

// @desc    Create new order
// @route   POST /api/orders
// @access  Private (Customer)
exports.createOrder = async (req, res, next) => {
  try {
    // Validate restaurant
    const restaurant = await Restaurant.findById(req.body.restaurant);
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Check if restaurant is open
    if (restaurant.status !== config.restaurantStatuses.OPEN) {
      return res.status(400).json({
        success: false,
        message: "Restaurant is currently closed",
      });
    }

    // Validate and process items
    if (!req.body.items || !req.body.items.length) {
      return res.status(400).json({
        success: false,
        message: "Please add at least one item to the order",
      });
    }

    // Calculate totals
    let subtotal = 0;
    const processedItems = [];

    for (const item of req.body.items) {
      const menuItem = await MenuItem.findById(item.menuItem);

      if (!menuItem) {
        return res.status(404).json({
          success: false,
          message: `Menu item not found: ${item.menuItem}`,
        });
      }

      if (!menuItem.available) {
        return res.status(400).json({
          success: false,
          message: `Menu item is not available: ${menuItem.name}`,
        });
      }

      if (menuItem.restaurant.toString() !== restaurant._id.toString()) {
        return res.status(400).json({
          success: false,
          message: `Menu item does not belong to the restaurant: ${menuItem.name}`,
        });
      }

      const itemPrice = menuItem.discountedPrice || menuItem.price;
      const quantity = parseInt(item.quantity, 10);

      if (isNaN(quantity) || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be at least 1",
        });
      }

      let itemSubtotal = itemPrice * quantity;

      // Process customizations if any
      let customizations = [];
      if (item.customizations && item.customizations.length > 0) {
        for (const customization of item.customizations) {
          // Validate against available customization options
          const menuCustomization = menuItem.customizationOptions.find(
            (c) => c.name === customization.name
          );

          if (!menuCustomization) {
            return res.status(400).json({
              success: false,
              message: `Invalid customization: ${customization.name}`,
            });
          }

          const processedOptions = [];

          for (const option of customization.options) {
            const menuOption = menuCustomization.options.find(
              (o) => o.name === option.name
            );

            if (!menuOption) {
              return res.status(400).json({
                success: false,
                message: `Invalid customization option: ${option.name}`,
              });
            }

            processedOptions.push({
              name: menuOption.name,
              price: menuOption.price,
            });

            itemSubtotal += menuOption.price * quantity;
          }

          customizations.push({
            name: customization.name,
            options: processedOptions,
          });
        }
      }

      processedItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        price: itemPrice,
        quantity,
        customizations,
        subtotal: itemSubtotal,
      });

      subtotal += itemSubtotal;
    }

    // Check if order meets minimum order amount
    if (subtotal < restaurant.minimumOrder) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount is $${restaurant.minimumOrder.toFixed(
          2
        )}`,
      });
    }

    // Rest of the function remains unchanged
    // ...
  } catch (err) {
    next(err);
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Admin & Restaurant)
exports.updateOrderStatus = async (req, res, next) => {
  // Implementation of updateOrderStatus function
};

// @desc    Rate an order
// @route   POST /api/orders/:id/rate
// @access  Private (Customer)
exports.rateOrder = async (req, res, next) => {
  // Implementation of rateOrder function
};
