const mongoose = require("mongoose");
const config = require("../config/config");

const RestaurantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Please add a restaurant name"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    description: {
      type: String,
      required: [true, "Please add a description"],
      maxlength: [500, "Description cannot be more than 500 characters"],
    },
    email: {
      type: String,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    phone: {
      type: String,
      required: [true, "Please add a phone number"],
    },
    address: {
      type: String,
      required: [true, "Please add an address"],
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
        index: "2dsphere",
      },
      formattedAddress: String,
      city: String,
      state: String,
      zipcode: String,
      country: String,
    },
    cuisineType: {
      type: [String],
      required: [true, "Please specify at least one cuisine type"],
    },
    openingHours: [
      {
        day: {
          type: Number, // 0 = Sunday, 1 = Monday, etc.
          required: true,
        },
        open: {
          type: String, // HH:MM format
          required: true,
        },
        close: {
          type: String, // HH:MM format
          required: true,
        },
        isClosed: {
          type: Boolean,
          default: false,
        },
      },
    ],
    averageRating: {
      type: Number,
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot be more than 5"],
      default: 0,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    photos: [String],
    coverImage: {
      type: String,
      default: "default-restaurant.jpg",
    },
    logo: {
      type: String,
      default: "default-logo.png",
    },
    minimumOrder: {
      type: Number,
      default: 0,
    },
    deliveryFee: {
      type: Number,
      default: 0,
    },
    deliveryTime: {
      type: Number, // in minutes
      default: 30,
    },
    freeDeliveryThreshold: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(config.restaurantStatuses),
      default: config.restaurantStatuses.CLOSED,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    acceptsOnlinePayments: {
      type: Boolean,
      default: true,
    },
    taxPercentage: {
      type: Number,
      default: 0,
    },
    bankDetails: {
      accountName: String,
      accountNumber: String,
      bankName: String,
      swiftCode: String,
    },
    stripeAccountId: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for restaurant menus
RestaurantSchema.virtual("menuItems", {
  ref: "MenuItem",
  localField: "_id",
  foreignField: "restaurant",
  justOne: false,
});

// Check if restaurant is currently open
RestaurantSchema.methods.isOpen = function () {
  if (this.status !== config.restaurantStatuses.OPEN) {
    return false;
  }

  const now = new Date();
  const day = now.getDay();
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  const todayHours = this.openingHours.find((h) => h.day === day);
  if (!todayHours || todayHours.isClosed) {
    return false;
  }

  return currentTime >= todayHours.open && currentTime <= todayHours.close;
};

module.exports = mongoose.model("Restaurant", RestaurantSchema);
