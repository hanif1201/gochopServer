const mongoose = require("mongoose");
const config = require("../config/config");

const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  rider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Rider",
    default: null,
  },
  items: [
    {
      menuItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MenuItem",
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: [1, "Quantity must be at least 1"],
      },
      customizations: [
        {
          name: String,
          options: [
            {
              name: String,
              price: Number,
            },
          ],
        },
      ],
      subtotal: {
        type: Number,
        required: true,
      },
    },
  ],
  deliveryAddress: {
    address: {
      type: String,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
      },
      index: "2dsphere", // Add this for geospatial queries
    },
    instructions: String,
  },
  status: {
    type: String,
    enum: Object.values(config.orderStatuses),
    default: config.orderStatuses.PENDING,
  },
  statusHistory: [
    {
      status: {
        type: String,
        enum: Object.values(config.orderStatuses),
        required: true,
      },
      time: {
        type: Date,
        default: Date.now,
      },
      note: String,
    },
  ],
  subtotal: {
    type: Number,
    required: true,
  },
  taxAmount: {
    type: Number,
    required: true,
  },
  deliveryFee: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: Object.values(config.paymentMethods),
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: Object.values(config.paymentStatuses),
    default: config.paymentStatuses.PENDING,
  },
  paymentId: String,
  estimatedDeliveryTime: {
    type: Date,
  },
  actualDeliveryTime: {
    type: Date,
  },
  rating: {
    restaurant: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: String,
      createdAt: {
        type: Date,
      },
    },
    rider: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: String,
      createdAt: {
        type: Date,
      },
    },
  },
  cancellationReason: String,
  cancelledBy: {
    type: String,
    enum: ["customer", "restaurant", "rider", "system", null],
    default: null,
  },
  refundStatus: {
    type: String,
    enum: ["pending", "processing", "completed", "failed", null],
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create index for faster searching
OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ restaurant: 1, createdAt: -1 });
OrderSchema.index({ rider: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });

// Properly index the geospatial field
OrderSchema.index({ "deliveryAddress.location": "2dsphere" });

// Method to update order status with history tracking
OrderSchema.methods.updateStatus = async function (status, note = "") {
  this.status = status;
  this.statusHistory.push({
    status,
    time: Date.now(),
    note,
  });

  // Set estimated delivery time when order is accepted
  if (status === config.orderStatuses.ACCEPTED) {
    // Properly populate the restaurant
    await this.populate("restaurant").execPopulate();
    const preparationTime = this.restaurant.deliveryTime || 30;
    this.estimatedDeliveryTime = new Date(Date.now() + preparationTime * 60000);
  }

  // Set actual delivery time
  if (status === config.orderStatuses.DELIVERED) {
    this.actualDeliveryTime = Date.now();
  }

  return this.save();
};

// Export the model
const Order = mongoose.model("Order", OrderSchema);
module.exports = Order;
