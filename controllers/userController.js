const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const Rider = require("../models/Rider");
const config = require("../config/config");
const geocoder = require("../utils/geocoder");

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin only)
exports.getUsers = async (req, res, next) => {
  try {
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ["select", "sort", "page", "limit", "role"];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach((param) => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `${match}`
    );

    // Finding resource
    let query = User.find(JSON.parse(queryStr));

    // Filter by role
    if (req.query.role) {
      query = query.find({ role: req.query.role });
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
    const total = await User.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const users = await query;

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
      count: users.length,
      pagination,
      data: users,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin or self)
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is authorized to view
    if (req.user.role !== config.roles.ADMIN && req.params.id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this user",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create user
// @route   POST /api/users
// @access  Private (Admin only)
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, phone, password, role } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Check if phone already exists
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: "Phone number already registered",
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: role || config.roles.CUSTOMER,
    });

    res.status(201).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin or self)
exports.updateUser = async (req, res, next) => {
  try {
    // Prevent updating password through this endpoint
    delete req.body.password;

    // Check for role change
    const roleChange = req.body.role && req.user.role === config.roles.ADMIN;

    // If only admin can change roles, prevent others from doing so
    if (req.body.role && req.user.role !== config.roles.ADMIN) {
      delete req.body.role;
    }

    // Find user
    let user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is authorized to update
    if (req.user.role !== config.roles.ADMIN && req.params.id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this user",
      });
    }

    // Handle role change logic
    if (roleChange) {
      const oldRole = user.role;
      const newRole = req.body.role;

      if (oldRole !== newRole) {
        // Handle role-specific updates
        if (oldRole === config.roles.RESTAURANT) {
          // User was a restaurant, remove or reassign restaurant
          const restaurant = await Restaurant.findOne({ user: user._id });
          if (restaurant) {
            await restaurant.remove();
          }
        } else if (oldRole === config.roles.RIDER) {
          // User was a rider, remove or reassign rider profile
          const rider = await Rider.findOne({ user: user._id });
          if (rider) {
            await rider.remove();
          }
        }
      }
    }

    // Update user
    user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Handle associated data based on user role
    if (user.role === config.roles.RESTAURANT) {
      // Remove associated restaurants
      await Restaurant.deleteMany({ user: user._id });
    } else if (user.role === config.roles.RIDER) {
      // Remove associated rider profile
      await Rider.deleteMany({ user: user._id });
    }

    // Delete user
    await user.remove();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add user address
// @route   POST /api/users/addresses
// @access  Private
exports.addAddress = async (req, res, next) => {
  try {
    const { name, address } = req.body;

    if (!name || !address) {
      return res.status(400).json({
        success: false,
        message: "Please provide name and address",
      });
    }

    const user = await User.findById(req.user.id);

    // Process geocoding
    let location = null;
    try {
      const loc = await geocoder.geocode(address);

      if (loc && loc.length > 0) {
        location = {
          type: "Point",
          coordinates: [loc[0].longitude, loc[0].latitude],
        };
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      // Continue even if geocoding fails
    }

    // Add address to user's saved addresses
    user.savedAddresses.push({
      name,
      address,
      location,
    });

    await user.save();

    res.status(201).json({
      success: true,
      data: user.savedAddresses,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Remove user address
// @route   DELETE /api/users/addresses/:id
// @access  Private
exports.removeAddress = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    // Find address by id
    const addressIndex = user.savedAddresses.findIndex(
      (addr) => addr._id.toString() === req.params.id
    );

    if (addressIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    // Remove address
    user.savedAddresses.splice(addressIndex, 1);
    await user.save();

    res.status(200).json({
      success: true,
      data: user.savedAddresses,
    });
  } catch (err) {
    next(err);
  }
};
