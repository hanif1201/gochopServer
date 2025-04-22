const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config/config");

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  // Check if auth header exists and starts with Bearer
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(" ")[1];
  }
  // If no token found, return unauthorized response
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);

    // Find user by id from decoded token
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found with this id",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }

    next();
  };
};

// Check if user is the owner of the resource or an admin
exports.checkOwnership = (model) => async (req, res, next) => {
  try {
    const resource = await model.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: "Resource not found",
      });
    }

    // Check if user is admin or owner
    const isAdmin = req.user.role === config.roles.ADMIN;
    const isOwner =
      resource.user && resource.user.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to modify this resource",
      });
    }

    req.resource = resource;
    next();
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
