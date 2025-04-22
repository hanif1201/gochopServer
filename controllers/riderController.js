const Rider = require("../models/Rider");
const User = require("../models/User");
const Order = require("../models/Order");
const config = require("../config/config");

// @desc    Get all riders
// @route   GET /api/riders
// @access  Private (Admin)
exports.getRiders = async (req, res, next) => {
  try {
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = [
      "select",
      "sort",
      "page",
      "limit",
      "status",
      "available",
      "near",
      "distance",
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
    let query = Rider.find(JSON.parse(queryStr));

    // Filter by status
    if (req.query.status) {
      query = query.find({ status: req.query.status });
    }

    // Filter by availability
    if (req.query.available) {
      const isAvailable = req.query.available === "true";
      query = query.find({ isAvailable });
    }

    // Filter by location
    if (req.query.near) {
      const [lat, lng] = req.query.near.split(",");
      const distance = parseInt(req.query.distance, 10) || 10; // Default 10km

      if (!isNaN(lat) && !isNaN(lng)) {
        query = query.find({
          "currentLocation.coordinates": {
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
    const total = await Rider.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Populate with user data
    query = query.populate("user", "name email phone");

    // Executing query
    const riders = await query;

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
      count: riders.length,
      pagination,
      data: riders,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single rider
// @route   GET /api/riders/:id
// @access  Private (Admin or self)
exports.getRider = async (req, res, next) => {
  try {
    const rider = await Rider.findById(req.params.id).populate(
      "user",
      "name email phone"
    );

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found",
      });
    }

    // Check if user is authorized to view
    if (
      req.user.role !== config.roles.ADMIN &&
      rider.user.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this rider",
      });
    }

    res.status(200).json({
      success: true,
      data: rider,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get rider profile for the current user
// @route   GET /api/riders/me
// @access  Private (Rider)
exports.getMyProfile = async (req, res, next) => {
  try {
    const rider = await Rider.findOne({ user: req.user.id }).populate(
      "user",
      "name email phone"
    );

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    res.status(200).json({
      success: true,
      data: rider,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create rider profile
// @route   POST /api/riders
// @access  Private (Admin or new rider)
exports.createRider = async (req, res, next) => {
  try {
    // Handle user association
    let userId;

    if (req.user.role === config.roles.ADMIN && req.body.userId) {
      // Admin creating a rider profile for an existing user
      const user = await User.findById(req.body.userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Update user role to rider
      user.role = config.roles.RIDER;
      await user.save();
      userId = user._id;
    } else if (req.user.role === config.roles.CUSTOMER) {
      // Customer becoming a rider
      req.user.role = config.roles.RIDER;
      await req.user.save();
      userId = req.user._id;
    } else if (req.user.role === config.roles.ADMIN && req.body.user) {
      // Admin creating a new user as a rider
      const { name, email, phone, password } = req.body.user;

      // Check if email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already registered",
        });
      }

      // Create user with rider role
      const user = await User.create({
        name,
        email,
        phone,
        password,
        role: config.roles.RIDER,
      });

      userId = user._id;
    } else {
      return res.status(400).json({
        success: false,
        message: "User information is required",
      });
    }

    // Check if rider profile already exists for this user
    const existingRider = await Rider.findOne({ user: userId });
    if (existingRider) {
      return res.status(400).json({
        success: false,
        message: "Rider profile already exists for this user",
      });
    }

    // Create rider profile
    req.body.user = userId;
    const rider = await Rider.create(req.body);

    res.status(201).json({
      success: true,
      data: rider,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update rider profile
// @route   PUT /api/riders/:id
// @access  Private (Admin or self)
exports.updateRider = async (req, res, next) => {
  try {
    let rider = await Rider.findById(req.params.id);

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found",
      });
    }

    // Check if user is authorized to update
    if (
      req.user.role !== config.roles.ADMIN &&
      rider.user.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this rider",
      });
    }

    // Prevent updating user field
    delete req.body.user;

    // Update rider
    rider = await Rider.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: rider,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete rider
// @route   DELETE /api/riders/:id
// @access  Private (Admin)
exports.deleteRider = async (req, res, next) => {
  try {
    const rider = await Rider.findById(req.params.id);

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found",
      });
    }

    // Ensure only admin can delete
    if (req.user.role !== config.roles.ADMIN) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete riders",
      });
    }

    // Update user role back to customer
    const user = await User.findById(rider.user);
    if (user) {
      user.role = config.roles.CUSTOMER;
      await user.save();
    }

    // Delete rider
    await rider.remove();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update rider availability status
// @route   PUT /api/riders/status
// @access  Private (Rider)
exports.updateStatus = async (req, res, next) => {
  try {
    // Find rider profile for current user
    let rider = await Rider.findOne({ user: req.user.id });

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    // Validate status
    const { status, isAvailable } = req.body;

    if (status && !Object.values(config.riderStatuses).includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Don't allow changing to available if current order exists
    if (rider.currentOrder && isAvailable === true) {
      return res.status(400).json({
        success: false,
        message: "Cannot set availability to true while having an active order",
      });
    }

    // Update fields if provided
    if (status !== undefined) rider.status = status;
    if (isAvailable !== undefined) rider.isAvailable = isAvailable;

    // If going offline, set availability to false
    if (status === config.riderStatuses.OFFLINE) {
      rider.isAvailable = false;
    }

    await rider.save();

    res.status(200).json({
      success: true,
      data: rider,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update rider location
// @route   PUT /api/riders/location
// @access  Private (Rider)
exports.updateLocation = async (req, res, next) => {
  try {
    // Find rider profile for current user
    let rider = await Rider.findOne({ user: req.user.id });

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    // Validate coordinates
    const { coordinates } = req.body;

    if (
      !coordinates ||
      !Array.isArray(coordinates) ||
      coordinates.length !== 2
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid coordinates are required",
      });
    }

    // Update location
    rider.currentLocation = {
      type: "Point",
      coordinates,
      lastUpdated: Date.now(),
    };

    await rider.save();

    // If rider has an active order, broadcast location to customer
    if (rider.currentOrder) {
      const order = await Order.findById(rider.currentOrder);
      if (order) {
        // This would ideally trigger a socket event
        // io.to(`user_${order.user}`).emit('riderLocationUpdated', {
        //   orderId: order._id,
        //   riderId: rider._id,
        //   location: rider.currentLocation
        // });
      }
    }

    res.status(200).json({
      success: true,
      data: rider,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get rider earnings
// @route   GET /api/riders/earnings
// @access  Private (Rider)
exports.getEarnings = async (req, res, next) => {
  try {
    // Find rider profile for current user
    const rider = await Rider.findOne({ user: req.user.id });

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found",
      });
    }

    // Get date range from query
    let { startDate, endDate } = req.query;
    startDate = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
    endDate = endDate ? new Date(endDate) : new Date();

    // End date should be end of the day
    endDate.setHours(23, 59, 59, 999);

    // Find all completed orders within date range
    const orders = await Order.find({
      rider: rider._id,
      status: config.orderStatuses.DELIVERED,
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Calculate total earnings and prepare summary
    const totalEarnings = orders.reduce(
      (total, order) => total + order.deliveryFee,
      0
    );
    const orderCount = orders.length;

    // Group by day for daily earnings
    const dailyEarnings = {};
    orders.forEach((order) => {
      const day = order.createdAt.toISOString().split("T")[0];
      if (!dailyEarnings[day]) {
        dailyEarnings[day] = {
          date: day,
          earnings: 0,
          orderCount: 0,
        };
      }
      dailyEarnings[day].earnings += order.deliveryFee;
      dailyEarnings[day].orderCount += 1;
    });

    res.status(200).json({
      success: true,
      data: {
        totalEarnings,
        orderCount,
        dailyEarnings: Object.values(dailyEarnings).sort((a, b) =>
          a.date.localeCompare(b.date)
        ),
      },
    });
  } catch (err) {
    next(err);
  }
};
