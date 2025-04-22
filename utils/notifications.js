const admin = require("firebase-admin");
const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const Rider = require("../models/Rider");

// Initialize Firebase Admin SDK
// This would normally be done at app startup, but is here for reference
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      ),
    });
  }
} catch (error) {
  console.error("Firebase admin initialization error:", error);
}

/**
 * Send push notification to a user
 * @param {Object} user - User object containing fcmToken
 * @param {String} title - Notification title
 * @param {String} body - Notification body
 * @param {Object} data - Additional data to send with notification
 */
exports.sendNotificationToUser = async (user, title, body, data = {}) => {
  try {
    if (!user || !user.fcmToken) {
      return;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data,
      token: user.fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log("Notification sent to user:", response);
    return response;
  } catch (error) {
    console.error("Error sending notification to user:", error);
  }
};

/**
 * Send push notification to a restaurant
 * @param {Object} restaurant - Restaurant object
 * @param {String} title - Notification title
 * @param {String} body - Notification body
 * @param {Object} data - Additional data to send with notification
 */
exports.sendNotificationToRestaurant = async (
  restaurant,
  title,
  body,
  data = {}
) => {
  try {
    if (!restaurant || !restaurant.user) {
      return;
    }

    // Get restaurant user
    const user = await User.findById(restaurant.user);
    if (!user || !user.fcmToken) {
      return;
    }

    return await exports.sendNotificationToUser(user, title, body, data);
  } catch (error) {
    console.error("Error sending notification to restaurant:", error);
  }
};

/**
 * Send push notification to a rider
 * @param {Object} rider - Rider object
 * @param {String} title - Notification title
 * @param {String} body - Notification body
 * @param {Object} data - Additional data to send with notification
 */
exports.sendNotificationToRider = async (rider, title, body, data = {}) => {
  try {
    if (!rider || !rider.user) {
      return;
    }

    // Get rider user
    const user = await User.findById(rider.user);
    if (!user || !user.fcmToken) {
      return;
    }

    return await exports.sendNotificationToUser(user, title, body, data);
  } catch (error) {
    console.error("Error sending notification to rider:", error);
  }
};

/**
 * Send push notification to multiple users
 * @param {Array} userIds - Array of user IDs
 * @param {String} title - Notification title
 * @param {String} body - Notification body
 * @param {Object} data - Additional data to send with notification
 */
exports.sendNotificationToMultipleUsers = async (
  userIds,
  title,
  body,
  data = {}
) => {
  try {
    if (!userIds || !userIds.length) {
      return;
    }

    // Get FCM tokens for users
    const users = await User.find({
      _id: { $in: userIds },
      fcmToken: { $exists: true, $ne: null },
    });

    const tokens = users.map((user) => user.fcmToken);

    if (!tokens.length) {
      return;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data,
      tokens,
    };

    const response = await admin.messaging().sendMulticast(message);
    console.log("Notification sent to multiple users:", response);
    return response;
  } catch (error) {
    console.error("Error sending notification to multiple users:", error);
  }
};

/**
 * Send notification to all riders in a specific area
 * @param {Array} coordinates - [longitude, latitude] of the center point
 * @param {Number} radiusInKm - Radius to search for riders
 * @param {String} title - Notification title
 * @param {String} body - Notification body
 * @param {Object} data - Additional data to send with notification
 */
exports.sendNotificationToRidersInArea = async (
  coordinates,
  radiusInKm,
  title,
  body,
  data = {}
) => {
  try {
    // Find riders in the area
    const riders = await Rider.find({
      "currentLocation.coordinates": {
        $geoWithin: {
          $centerSphere: [coordinates, radiusInKm / 6378.1],
        },
      },
      status: "online",
      isAvailable: true,
    });

    if (!riders.length) {
      return;
    }

    // Get user IDs
    const userIds = riders.map((rider) => rider.user);

    // Send notifications to those users
    return await exports.sendNotificationToMultipleUsers(
      userIds,
      title,
      body,
      data
    );
  } catch (error) {
    console.error("Error sending notification to riders in area:", error);
  }
};
