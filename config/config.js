// Application configuration settings
module.exports = {
  jwtSecret: process.env.JWT_SECRET || "gochop_secret_key",
  jwtExpire: process.env.JWT_EXPIRE || "30d",

  // Default pagination settings
  pagination: {
    defaultPage: 1,
    defaultLimit: 10,
  },

  // Order status options
  orderStatuses: {
    PENDING: "pending",
    ACCEPTED: "accepted",
    PREPARING: "preparing",
    READY_FOR_PICKUP: "ready_for_pickup",
    ASSIGNED_TO_RIDER: "assigned_to_rider",
    PICKED_UP: "picked_up",
    ON_THE_WAY: "on_the_way",
    DELIVERED: "delivered",
    CANCELLED: "cancelled",
  },

  // User roles
  roles: {
    CUSTOMER: "customer",
    RESTAURANT: "restaurant",
    RIDER: "rider",
    ADMIN: "admin",
  },

  // Rider status options
  riderStatuses: {
    OFFLINE: "offline",
    ONLINE: "online",
    BUSY: "busy",
  },

  // Restaurant status options
  restaurantStatuses: {
    OPEN: "open",
    CLOSED: "closed",
    BUSY: "busy",
  },

  // Payment status options
  paymentStatuses: {
    PENDING: "pending",
    COMPLETED: "completed",
    FAILED: "failed",
    REFUNDED: "refunded",
  },

  // Payment methods
  paymentMethods: {
    CASH: "cash",
    CARD: "card",
    WALLET: "wallet",
  },

  // Geocoder configuration
  geocoder: {
    provider: process.env.GEOCODER_PROVIDER || "mapquest",
    apiKey: process.env.GEOCODER_API_KEY,
  },

  // Upload file size limits
  fileUpload: {
    maxSize: 1024 * 1024 * 5, // 5MB
  },

  // Delivery fee calculation
  deliveryFee: {
    baseFee: 2.5,
    perKmRate: 0.5,
    minDistance: 1, // km
  },
};
