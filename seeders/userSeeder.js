const bcrypt = require("bcryptjs");
const User = require("../models/User");
const mongoose = require("mongoose");

const createUser = async (userData) => {
  try {
    // Delete existing user with this email
    await User.deleteOne({ email: userData.email });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    // Create user document
    const userDoc = {
      _id: new mongoose.Types.ObjectId(),
      ...userData,
      password: hashedPassword,
      isEmailVerified: true,
      isActive: true,
      createdAt: new Date(),
    };

    // Insert directly using MongoDB driver
    const result = await mongoose.connection
      .collection("users")
      .insertOne(userDoc);

    console.log(`Created ${userData.role}:`, {
      email: userData.email,
      role: userData.role,
      success: !!result.insertedId,
    });

    return result;
  } catch (error) {
    console.error(`Error creating ${userData.role}:`, error);
    throw error;
  }
};

const seedUsers = async () => {
  try {
    console.log("Starting user seeding process...");

    // Create Super Admin
    await createUser({
      name: "Super Admin",
      email: "superadmin@gochop.com",
      password: "superadmin123",
      role: "admin",
      status: "active",
      phone: "+233000000001",
      isSuperAdmin: true,
    });

    // Create Restaurant Admin
    await createUser({
      name: "Restaurant Admin",
      email: "restaurant@gochop.com",
      password: "restaurant123",
      role: "restaurant",
      status: "active",
      phone: "+233000000002",
      isSuperAdmin: false,
      address: "Restaurant Address",
      location: {
        type: "Point",
        coordinates: [0, 0], // Add actual coordinates
      },
    });

    // Create Rider
    await createUser({
      name: "Delivery Rider",
      email: "rider@gochop.com",
      password: "rider123",
      role: "rider",
      status: "active",
      phone: "+233000000003",
      isSuperAdmin: false,
      address: "Rider Address",
      location: {
        type: "Point",
        coordinates: [0, 0], // Add actual coordinates
      },
    });

    // Create Regular User
    await createUser({
      name: "Regular User",
      email: "user@gochop.com",
      password: "user123",
      role: "customer",
      status: "active",
      phone: "+233000000004",
      isSuperAdmin: false,
      address: "User Address",
      location: {
        type: "Point",
        coordinates: [0, 0], // Add actual coordinates
      },
    });

    console.log("User seeding completed successfully");
  } catch (error) {
    console.error("Error in user seeding:", error);
    throw error;
  }
};

module.exports = seedUsers;
