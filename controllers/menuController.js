const MenuItem = require("../models/MenuItem");
const Restaurant = require("../models/Restaurant");
const config = require("../config/config");

// @desc    Get all menu items
// @route   GET /api/menu
// @access  Public
exports.getMenuItems = async (req, res, next) => {
  try {
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = [
      "select",
      "sort",
      "page",
      "limit",
      "category",
      "restaurant",
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
    let query = MenuItem.find(JSON.parse(queryStr));

    // Filter by restaurant
    if (req.query.restaurant) {
      query = query.find({ restaurant: req.query.restaurant });
    }

    // Filter by category
    if (req.query.category) {
      const categories = req.query.category.split(",");
      query = query.find({ category: { $in: categories } });
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
      query = query.sort("category");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || config.pagination.defaultPage;
    const limit =
      parseInt(req.query.limit, 10) || config.pagination.defaultLimit;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await MenuItem.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Populate with restaurant info
    query = query.populate({
      path: "restaurant",
      select: "name averageRating",
    });

    // Executing query
    const menuItems = await query;

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
      count: menuItems.length,
      pagination,
      data: menuItems,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single menu item
// @route   GET /api/menu/:id
// @access  Public
exports.getMenuItem = async (req, res, next) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id).populate({
      path: "restaurant",
      select: "name averageRating",
    });

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    res.status(200).json({
      success: true,
      data: menuItem,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new menu item
// @route   POST /api/menu
// @access  Private (Restaurant or Admin)
exports.createMenuItem = async (req, res, next) => {
  try {
    // Check if restaurant exists and user is authorized
    const restaurant = await Restaurant.findById(req.body.restaurant);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Check if user owns the restaurant or is admin
    if (
      restaurant.user.toString() !== req.user.id &&
      req.user.role !== config.roles.ADMIN
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to add menu items to this restaurant",
      });
    }

    const menuItem = await MenuItem.create(req.body);

    res.status(201).json({
      success: true,
      data: menuItem,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update menu item
// @route   PUT /api/menu/:id
// @access  Private (Restaurant owner or Admin)
exports.updateMenuItem = async (req, res, next) => {
  try {
    let menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    // Check if user owns the restaurant or is admin
    const restaurant = await Restaurant.findById(menuItem.restaurant);

    if (
      restaurant.user.toString() !== req.user.id &&
      req.user.role !== config.roles.ADMIN
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this menu item",
      });
    }

    menuItem = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: menuItem,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete menu item
// @route   DELETE /api/menu/:id
// @access  Private (Restaurant owner or Admin)
exports.deleteMenuItem = async (req, res, next) => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    // Check if user owns the restaurant or is admin
    const restaurant = await Restaurant.findById(menuItem.restaurant);

    if (
      restaurant.user.toString() !== req.user.id &&
      req.user.role !== config.roles.ADMIN
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this menu item",
      });
    }

    await menuItem.remove();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle menu item availability
// @route   PUT /api/menu/:id/toggle-availability
// @access  Private (Restaurant owner or Admin)
exports.toggleAvailability = async (req, res, next) => {
  try {
    let menuItem = await MenuItem.findById(req.params.id);

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: "Menu item not found",
      });
    }

    // Check if user owns the restaurant or is admin
    const restaurant = await Restaurant.findById(menuItem.restaurant);

    if (
      restaurant.user.toString() !== req.user.id &&
      req.user.role !== config.roles.ADMIN
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this menu item",
      });
    }

    // Toggle availability
    menuItem.available = !menuItem.available;
    await menuItem.save();

    res.status(200).json({
      success: true,
      data: menuItem,
    });
  } catch (err) {
    next(err);
  }
};
