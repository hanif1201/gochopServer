const User = require("../models/User");
const config = require("../config/config");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password, role, address } = req.body;

    // Check if user exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        message: "Phone number already registered",
      });
    }

    // Validate role if provided
    if (role && role !== config.roles.CUSTOMER) {
      // Only allow customer registration through public endpoint
      return res.status(400).json({
        success: false,
        message: "Invalid role specified",
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: config.roles.CUSTOMER, // Force customer role for public registration
      address: address || "",
    });

    // Generate and return token
    sendTokenResponse(user, 201, res);
  } catch (err) {
    next(err);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const dashboardType = req.headers["x-dashboard-type"];

    console.log("Login attempt:", { email, dashboardType });

    // Check for user
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Your account has been deactivated",
      });
    }

    // Validate access based on dashboard type
    if (dashboardType) {
      const isAllowed = validateDashboardAccess(dashboardType, user);
      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          message: `Unauthorized access. Please use the ${user.role} dashboard.`,
        });
      }
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate refresh token and store it
    const refreshToken = generateRefreshToken();
    user.refreshTokens = user.refreshTokens || [];
    user.refreshTokens.push({ token: refreshToken });
    await user.save();

    // Generate and return tokens
    sendTokenResponse(user, 200, res, refreshToken);
  } catch (err) {
    console.error("Login error:", err);
    next(err);
  }
};

// @desc    Log user out / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    // If using FCM token, clear it
    if (req.user && req.user.fcmToken) {
      req.user.fcmToken = null;
      await req.user.save();
    }

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    // user is already available in req due to the protect middleware
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
    };

    // Remove undefined fields
    Object.keys(fieldsToUpdate).forEach(
      (key) => fieldsToUpdate[key] === undefined && delete fieldsToUpdate[key]
    );

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
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

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("+password");

    // Check current password
    if (!(await user.matchPassword(req.body.currentPassword))) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = req.body.newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "There is no user with that email",
      });
    }

    // Get reset token
    const resetToken = crypto.randomBytes(20).toString("hex");

    // Hash token and set to resetPasswordToken field
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Set expire
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    await user.save({ validateBeforeSave: false });

    // In a real app, send email with the reset link
    // For this example, we'll just return the token

    res.status(200).json({
      success: true,
      message: "Password reset token sent",
      resetToken, // In production, this would be sent via email, not API response
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.resettoken)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid token or token expired",
      });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh-token
// @access  Public
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: "Refresh token required" });
    }
    const user = await User.findOne({ "refreshTokens.token": refreshToken });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid refresh token" });
    }
    // Optionally: remove the old refresh token
    user.refreshTokens = user.refreshTokens.filter(
      (rt) => rt.token !== refreshToken
    );

    // Generate and store a new refresh token
    const newRefreshToken = generateRefreshToken();
    user.refreshTokens.push({ token: newRefreshToken });
    await user.save();

    const accessToken = user.getSignedJwtToken();
    res.status(200).json({
      success: true,
      token: accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        address: user.address,
        location: user.location,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Helper function to validate dashboard access
const validateDashboardAccess = (dashboardType, user) => {
  switch (dashboardType) {
    case "admin":
      // Only super admin can access admin dashboard
      return user.role === "admin" && user.isSuperAdmin;

    case "restaurant":
      // Only restaurant users can access restaurant dashboard
      return user.role === "restaurant";

    case "rider":
      // Only riders can access rider dashboard
      return user.role === "rider";

    case "customer":
      // Only customers can access customer dashboard
      return user.role === "customer";

    default:
      return false;
  }
};

// Helper to generate a refresh token
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString("hex");
};

// Helper function to get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res, refreshToken) => {
  const token = user.getSignedJwtToken();
  const response = {
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
      address: user.address,
      location: user.location,
    },
  };
  if (refreshToken) {
    response.refreshToken = refreshToken;
  }
  res.status(statusCode).json(response);
};
