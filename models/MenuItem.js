const mongoose = require("mongoose");

const MenuItemSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  name: {
    type: String,
    required: [true, "Please add a name"],
    trim: true,
    maxlength: [100, "Name can not be more than 100 characters"],
  },
  description: {
    type: String,
    required: [true, "Please add a description"],
    maxlength: [500, "Description can not be more than 500 characters"],
  },
  price: {
    type: Number,
    required: [true, "Please add a price"],
  },
  discountedPrice: {
    type: Number,
  },
  image: {
    type: String,
    default: "default-food.jpg",
  },
  category: {
    type: String,
    required: [true, "Please add a category"],
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
    type: Number, // in minutes
    default: 15,
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
  available: {
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
