const mongoose = require("mongoose");

const MenuItemSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  name: {
    type: String,
    required: [true, "Please add a menu item name"],
    trim: true,
    maxlength: [50, "Name cannot be more than 50 characters"],
  },
  description: {
    type: String,
    required: [true, "Please add a description"],
    maxlength: [500, "Description cannot be more than 500 characters"],
  },
  price: {
    type: Number,
    required: [true, "Please add a price"],
    min: [0, "Price cannot be negative"],
  },
  discountedPrice: {
    type: Number,
  },
  image: {
    type: String,
    default: "default-food-image.jpg",
  },
  category: {
    type: String,
    required: [true, "Please specify a category"],
  },
  isVeg: {
    type: Boolean,
    default: false,
  },
  isVegan: {
    type: Boolean,
    default: false,
  },
  isGlutenFree: {
    type: Boolean,
    default: false,
  },
  customizationOptions: [
    {
      name: {
        type: String,
        required: true,
      },
      required: {
        type: Boolean,
        default: false,
      },
      multiSelect: {
        type: Boolean,
        default: false,
      },
      options: [
        {
          name: {
            type: String,
            required: true,
          },
          price: {
            type: Number,
            default: 0,
          },
        },
      ],
    },
  ],
  preparationTime: {
    type: Number,
    required: [true, "Please add preparation time in minutes"],
    min: [0, "Preparation time cannot be negative"],
  },
  spicyLevel: {
    type: Number,
    min: 0,
    max: 3,
    default: 0,
  },
  featured: {
    type: Boolean,
    default: false,
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create index for searching menu items
MenuItemSchema.index({
  name: "text",
  description: "text",
  category: "text",
});

module.exports = mongoose.model("MenuItem", MenuItemSchema);
