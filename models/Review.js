const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  rating: {
    type: Number,
    required: [true, "Please add a rating"],
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    required: [true, "Please add a comment"],
    maxlength: [500, "Comment cannot be more than 500 characters"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Prevent user from submitting more than one review per order
ReviewSchema.index({ order: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Review", ReviewSchema);
