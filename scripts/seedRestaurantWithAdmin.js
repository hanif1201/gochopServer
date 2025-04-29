const mongoose = require("mongoose");
const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const seedRestaurantWithAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Create restaurant admin user data
    const restaurantAdminData = {
      name: "Restaurant Admin",
      email: "restaurant@gochop.com",
      password: "Restaurant@123",
      phone: "+1234567890",
      role: "restaurant",
      isActive: true,
    };

    // Check if restaurant admin already exists
    const existingAdmin = await User.findOne({
      email: restaurantAdminData.email,
    });

    let restaurantAdmin;
    if (existingAdmin) {
      console.log("Restaurant admin user already exists");
      console.log("User details:", {
        id: existingAdmin._id,
        email: existingAdmin.email,
        role: existingAdmin.role,
        isActive: existingAdmin.isActive,
      });

      // Update the existing admin's password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("Restaurant@123", salt);

      restaurantAdmin = await User.findByIdAndUpdate(
        existingAdmin._id,
        {
          password: hashedPassword,
          role: "restaurant", // Ensure role is correct
          isActive: true, // Ensure account is active
        },
        { new: true }
      );

      console.log("Updated admin password");
    } else {
      // Hash password
      const salt = await bcrypt.genSalt(10);
      restaurantAdminData.password = await bcrypt.hash(
        restaurantAdminData.password,
        salt
      );

      // Create restaurant admin user
      restaurantAdmin = await User.create(restaurantAdminData);
      console.log(
        "Restaurant admin user created successfully:",
        restaurantAdmin.email
      );
    }

    // Create restaurant data
    const restaurantData = {
      user: restaurantAdmin._id,
      name: "Demo Restaurant",
      description: "A demo restaurant for testing",
      email: restaurantAdmin.email,
      phone: restaurantAdmin.phone,
      address: "123 Demo Street, Demo City, 12345",
      cuisineType: ["Demo Cuisine"],
      openingHours: [
        {
          day: 0,
          open: "09:00",
          close: "22:00",
          isClosed: false,
        },
        {
          day: 1,
          open: "09:00",
          close: "22:00",
          isClosed: false,
        },
        {
          day: 2,
          open: "09:00",
          close: "22:00",
          isClosed: false,
        },
        {
          day: 3,
          open: "09:00",
          close: "22:00",
          isClosed: false,
        },
        {
          day: 4,
          open: "09:00",
          close: "22:00",
          isClosed: false,
        },
        {
          day: 5,
          open: "09:00",
          close: "22:00",
          isClosed: false,
        },
        {
          day: 6,
          open: "09:00",
          close: "22:00",
          isClosed: false,
        },
      ],
      status: "closed",
      isActive: true,
      averageRating: 5,
      ratingCount: 0,
      minimumOrder: 10,
      deliveryFee: 5,
      deliveryTime: 30,
      taxPercentage: 10,
    };

    // Check if restaurant already exists
    const existingRestaurant = await Restaurant.findOne({
      user: restaurantAdmin._id,
    });

    if (existingRestaurant) {
      console.log("Restaurant already exists");
    } else {
      // Create restaurant
      const restaurant = await Restaurant.create(restaurantData);
      console.log("Restaurant created successfully:", restaurant.name);
    }
  } catch (error) {
    console.error("Error seeding restaurant and admin:", error);
  } finally {
    await mongoose.disconnect();
  }
};

seedRestaurantWithAdmin();
