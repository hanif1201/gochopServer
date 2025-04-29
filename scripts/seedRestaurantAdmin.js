const mongoose = require("mongoose");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const seedRestaurantAdmin = async () => {
  try {
    // Connect to MongoDB using the environment variable
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
      restaurant: null, // This will be linked to a restaurant later
    };

    // Check if restaurant admin already exists
    const existingAdmin = await User.findOne({
      email: restaurantAdminData.email,
    });
    if (existingAdmin) {
      console.log("Restaurant admin user already exists");
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    restaurantAdminData.password = await bcrypt.hash(
      restaurantAdminData.password,
      salt
    );

    // Create restaurant admin user
    const restaurantAdmin = await User.create(restaurantAdminData);
    console.log(
      "Restaurant admin user created successfully:",
      restaurantAdmin.email
    );
  } catch (error) {
    console.error("Error seeding restaurant admin:", error);
  } finally {
    await mongoose.disconnect();
  }
};

seedRestaurantAdmin();
