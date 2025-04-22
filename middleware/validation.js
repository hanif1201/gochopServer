const { validationResult, check } = require("express-validator");
const config = require("../config/config");

// Process validation results middleware
exports.validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  next();
};

// User validation rules
exports.registerValidation = [
  check("name", "Name is required").not().isEmpty(),
  check("email", "Please include a valid email").isEmail(),
  check("phone", "Please enter a valid phone number").not().isEmpty(),
  check("password", "Password must be at least 6 characters").isLength({
    min: 6,
  }),
  check("role")
    .optional()
    .isIn(Object.values(config.roles))
    .withMessage("Invalid role"),
];

exports.loginValidation = [
  check("email", "Please include a valid email").isEmail(),
  check("password", "Password is required").exists(),
];

exports.updatePasswordValidation = [
  check("currentPassword", "Current password is required").not().isEmpty(),
  check("newPassword", "New password must be at least 6 characters").isLength({
    min: 6,
  }),
];

// Restaurant validation rules
exports.restaurantValidation = [
  check("name", "Name is required").not().isEmpty(),
  check("description", "Description is required").not().isEmpty(),
  check("phone", "Phone number is required").not().isEmpty(),
  check("address", "Address is required").not().isEmpty(),
  check("cuisineType", "At least one cuisine type is required").isArray({
    min: 1,
  }),
  check("openingHours", "Opening hours are required").isArray({ min: 1 }),
];

// Menu item validation rules
exports.menuItemValidation = [
  check("restaurant", "Restaurant ID is required").isMongoId(),
  check("name", "Name is required").not().isEmpty(),
  check("description", "Description is required").not().isEmpty(),
  check("price", "Price is required and must be a number").isNumeric(),
  check("category", "Category is required").not().isEmpty(),
];

// Order validation rules
exports.orderValidation = [
  check("restaurant", "Restaurant ID is required").isMongoId(),
  check("items", "At least one item is required").isArray({ min: 1 }),
  check(
    "items.*.menuItem",
    "Menu item ID is required for all items"
  ).isMongoId(),
  check("items.*.quantity", "Quantity is required and must be a number").isInt({
    min: 1,
  }),
  check("deliveryAddress", "Delivery address is required").not().isEmpty(),
  check("deliveryAddress.address", "Address string is required")
    .not()
    .isEmpty(),
  check("paymentMethod", "Payment method is required")
    .isIn(Object.values(config.paymentMethods))
    .withMessage("Invalid payment method"),
];

// Order status update validation
exports.orderStatusValidation = [
  check("status", "Status is required")
    .isIn(Object.values(config.orderStatuses))
    .withMessage("Invalid order status"),
];

// Rider validation rules
exports.riderValidation = [
  check("firstName", "First name is required").not().isEmpty(),
  check("lastName", "Last name is required").not().isEmpty(),
  check("dateOfBirth", "Date of birth is required").isDate(),
  check("nationalId", "National ID is required").not().isEmpty(),
  check("vehicleType", "Vehicle type is required")
    .isIn(["motorcycle", "bicycle", "car", "scooter"])
    .withMessage("Invalid vehicle type"),
];

// Rider status validation
exports.riderStatusValidation = [
  check("status")
    .optional()
    .isIn(Object.values(config.riderStatuses))
    .withMessage("Invalid rider status"),
  check("isAvailable")
    .optional()
    .isBoolean()
    .withMessage("isAvailable must be a boolean"),
];

// Rider location validation
exports.riderLocationValidation = [
  check("coordinates", "Coordinates are required").isArray({ min: 2, max: 2 }),
  check(
    "coordinates.0",
    "Longitude must be a number between -180 and 180"
  ).isFloat({ min: -180, max: 180 }),
  check(
    "coordinates.1",
    "Latitude must be a number between -90 and 90"
  ).isFloat({ min: -90, max: 90 }),
];
