const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const Restaurant = require("../models/Restaurant");
const User = require("../models/User");
const Rider = require("../models/Rider");
const config = require("../config/config");
const notifications = require("../utils/notifications");
const geocoder = require("../utils/geocoder");
const paymentGateway = require("../utils/paymentGateway");

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private (Admin)
exports.getOrders = async (req, res, next) => {
  try {
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ["select", "sort", "page", "limit", "status"];

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
    let query = Order.find(JSON.parse(queryStr));

    // Filter by status
    if (req.query.status) {
      const statuses = req.query.status.split(",");
      query = query.find({ status: { $in: statuses } });
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
      query = query.sort("-createdAt");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || config.pagination.defaultPage;
    const limit =
      parseInt(req.query.limit, 10) || config.pagination.defaultLimit;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await Order.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Populate with related data
    query = query.populate([
      { path: "user", select: "name email phone" },
      { path: "restaurant", select: "name address phone" },
      { path: "rider", select: "firstName lastName phone" },
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
    const order = await Order.findById(req.params.id).populate([
      { path: "user", select: "name email phone" },
      { path: "restaurant", select: "name address phone" },
      { path: "rider", select: "firstName lastName phone" },
      { path: "items.menuItem", select: "name price image" },
    ]);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user is authorized to view this order
    if (
      req.user.role === config.roles.CUSTOMER &&
      order.user.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }

    if (req.user.role === config.roles.RESTAURANT) {
      const restaurants = await Restaurant.find({ user: req.user.id });
      const restaurantIds = restaurants.map((r) => r._id.toString());

      if (!restaurantIds.includes(order.restaurant.toString())) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this order",
        });
      }
    }

    if (req.user.role === config.roles.RIDER) {
      const rider = await Rider.findOne({ user: req.user.id });
      if (!rider || order.rider.toString() !== rider._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this order",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (err) {
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
        message: `Minimum order amount is ${restaurant.minimumOrder}`,
      });
    }

    // Process delivery address
    let deliveryAddress = req.body.deliveryAddress;

    if (!deliveryAddress || !deliveryAddress.address) {
      return res.status(400).json({
        success: false,
        message: "Delivery address is required",
      });
    }

    // Geocode the address if coordinates not provided
    if (!deliveryAddress.location || !deliveryAddress.location.coordinates) {
      try {
        const loc = await geocoder.geocode(deliveryAddress.address);

        if (loc && loc.length > 0) {
          deliveryAddress.location = {
            type: "Point",
            coordinates: [loc[0].longitude, loc[0].latitude],
          };
        }
      } catch (err) {
        console.error("Geocoding error:", err);
        // Continue even if geocoding fails
      }
    }

    // Calculate delivery fee
    let deliveryFee = restaurant.deliveryFee;

    // If free delivery threshold is reached
    if (
      restaurant.freeDeliveryThreshold > 0 &&
      subtotal >= restaurant.freeDeliveryThreshold
    ) {
      deliveryFee = 0;
    }

    // Calculate tax
    const taxAmount = (subtotal * restaurant.taxPercentage) / 100;

    // Calculate total
    const total = subtotal + taxAmount + deliveryFee - (req.body.discount || 0);

    // Process payment
    let paymentStatus = config.paymentStatuses.PENDING;
    let paymentId = null;

    if (req.body.paymentMethod === config.paymentMethods.CARD) {
      try {
        // Process payment with Stripe
        const payment = await paymentGateway.processPayment({
          amount: total,
          currency: "usd",
          paymentMethodId: req.body.paymentMethodId,
          customerId: req.body.stripeCustomerId,
          description: `Order for ${restaurant.name}`,
        });

        paymentStatus = config.paymentStatuses.COMPLETED;
        paymentId = payment.id;
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: "Payment failed: " + err.message,
        });
      }
    }

    // Create order
    const order = await Order.create({
      user: req.user.id,
      restaurant: restaurant._id,
      items: processedItems,
      deliveryAddress,
      subtotal,
      taxAmount,
      deliveryFee,
      discount: req.body.discount || 0,
      total,
      paymentMethod: req.body.paymentMethod,
      paymentStatus,
      paymentId,
      statusHistory: [
        {
          status: config.orderStatuses.PENDING,
          time: Date.now(),
          note: "Order placed",
        },
      ],
    });

    // Send notification to restaurant
    notifications.sendNotificationToRestaurant(
      restaurant,
      "New Order",
      `You have received a new order #${order._id.toString().slice(-6)}`
    );

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check authorization based on user role and requested status change
    const { status, note } = req.body;

    if (!status || !Object.values(config.orderStatuses).includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Check authorization based on role and status transition
    let isAuthorized = false;
    const currentStatus = order.status;

    if (req.user.role === config.roles.ADMIN) {
      // Admin can update to any status
      isAuthorized = true;
    } else if (req.user.role === config.roles.RESTAURANT) {
      // Check if user owns the restaurant
      const restaurant = await Restaurant.findById(order.restaurant);
      if (!restaurant || restaurant.user.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this order",
        });
      }

      // Restaurant can update to these statuses
      const allowedRestaurantStatuses = [
        config.orderStatuses.ACCEPTED,
        config.orderStatuses.PREPARING,
        config.orderStatuses.READY_FOR_PICKUP,
        config.orderStatuses.CANCELLED,
      ];

      isAuthorized = allowedRestaurantStatuses.includes(status);
    } else if (req.user.role === config.roles.RIDER) {
      // Check if order is assigned to this rider
      const rider = await Rider.findOne({ user: req.user.id });
      if (
        !rider ||
        !order.rider ||
        order.rider.toString() !== rider._id.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this order",
        });
      }

      // Rider can update to these statuses
      const allowedRiderStatuses = [
        config.orderStatuses.PICKED_UP,
        config.orderStatuses.ON_THE_WAY,
        config.orderStatuses.DELIVERED,
      ];

      isAuthorized = allowedRiderStatuses.includes(status);
    } else if (req.user.role === config.roles.CUSTOMER) {
      // Customer can only cancel their own pending order
      if (order.user.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this order",
        });
      }

      isAuthorized =
        status === config.orderStatuses.CANCELLED &&
        currentStatus === config.orderStatuses.PENDING;
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: `Not authorized to change status to ${status}`,
      });
    }

    // Handle special cases based on status transition
    if (status === config.orderStatuses.ASSIGNED_TO_RIDER) {
      // Validate and assign rider
      if (!req.body.riderId) {
        return res.status(400).json({
          success: false,
          message: "Rider ID is required",
        });
      }

      const rider = await Rider.findById(req.body.riderId);
      if (!rider) {
        return res.status(404).json({
          success: false,
          message: "Rider not found",
        });
      }

      // Check if rider is available
      if (rider.status !== config.riderStatuses.ONLINE || !rider.isAvailable) {
        return res.status(400).json({
          success: false,
          message: "Rider is not available",
        });
      }

      // Assign rider to order
      order.rider = rider._id;

      // Update rider status
      rider.status = config.riderStatuses.BUSY;
      rider.isAvailable = false;
      rider.currentOrder = order._id;
      await rider.save();

      // Send notification to rider
      notifications.sendNotificationToRider(
        rider,
        "New Delivery Assignment",
        `You have been assigned a new order #${order._id.toString().slice(-6)}`
      );
    }

    if (status === config.orderStatuses.CANCELLED) {
      // Record who cancelled
      if (req.user.role === config.roles.CUSTOMER) {
        order.cancelledBy = "customer";
      } else if (req.user.role === config.roles.RESTAURANT) {
        order.cancelledBy = "restaurant";
      } else if (req.user.role === config.roles.RIDER) {
        order.cancelledBy = "rider";
      } else {
        order.cancelledBy = "system";
      }

      order.cancellationReason = note || "No reason provided";

      // Handle payment refund if needed
      if (
        order.paymentMethod === config.paymentMethods.CARD &&
        order.paymentStatus === config.paymentStatuses.COMPLETED
      ) {
        try {
          await paymentGateway.processRefund(order.paymentId);
          order.refundStatus = "completed";
        } catch (err) {
          console.error("Refund failed:", err);
          order.refundStatus = "failed";
        }
      }

      // Release rider if assigned
      if (order.rider) {
        const rider = await Rider.findById(order.rider);
        if (rider) {
          rider.status = config.riderStatuses.ONLINE;
          rider.isAvailable = true;
          rider.currentOrder = null;
          await rider.save();
        }
      }
    }

    if (status === config.orderStatuses.DELIVERED) {
      // Update actual delivery time
      order.actualDeliveryTime = Date.now();

      // Update rider status
      if (order.rider) {
        const rider = await Rider.findById(order.rider);
        if (rider) {
          rider.status = config.riderStatuses.ONLINE;
          rider.isAvailable = true;
          rider.currentOrder = null;

          // Update rider earnings
          // This is simplified, in a real app you would have a more complex earning structure
          rider.totalEarnings += order.deliveryFee;

          await rider.save();
        }
      }
    }

    // Update order status
    order.status = status;
    order.statusHistory.push({
      status,
      time: Date.now(),
      note: note || "",
    });

    await order.save();

    // Send notification to user
    notifications.sendNotificationToUser(
      await User.findById(order.user),
      "Order Update",
      `Your order #${order._id.toString().slice(-6)} status is now: ${status}`
    );

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Rate and review an order
// @route   POST /api/orders/:id/rate
// @access  Private (Customer)
exports.rateOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify the user is the customer who placed the order
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only rate your own orders",
      });
    }

    // Verify order is delivered
    if (order.status !== config.orderStatuses.DELIVERED) {
      return res.status(400).json({
        success: false,
        message: "You can only rate delivered orders",
      });
    }

    // Process restaurant rating
    if (req.body.restaurantRating) {
      const { rating, comment } = req.body.restaurantRating;

      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: "Rating must be between 1 and 5",
        });
      }

      order.rating.restaurant = {
        rating,
        comment: comment || "",
        createdAt: Date.now(),
      };

      // Update restaurant's average rating
      const restaurant = await Restaurant.findById(order.restaurant);
      if (restaurant) {
        const newRatingCount = restaurant.ratingCount + 1;
        const newAverageRating =
          (restaurant.averageRating * restaurant.ratingCount + rating) /
          newRatingCount;

        restaurant.ratingCount = newRatingCount;
        restaurant.averageRating = newAverageRating;
        await restaurant.save();
      }
    }

    // Process rider rating
    if (req.body.riderRating && order.rider) {
      const { rating, comment } = req.body.riderRating;

      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: "Rating must be between 1 and 5",
        });
      }

      order.rating.rider = {
        rating,
        comment: comment || "",
        createdAt: Date.now(),
      };

      // Update rider's average rating
      const rider = await Rider.findById(order.rider);
      if (rider) {
        const newRatingCount = rider.numberOfRatings + 1;
        const newAverageRating =
          (rider.averageRating * rider.numberOfRatings + rating) /
          newRatingCount;

        rider.numberOfRatings = newRatingCount;
        rider.averageRating = newAverageRating;
        await rider.save();
      }
    }

    await order.save();

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
};
