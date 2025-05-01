const bcrypt = require("bcryptjs");
const User = require("../models/User");
const mongoose = require("mongoose");

const seedSuperAdmin = async () => {
  try {
    console.log("Starting super admin seeding process...");

    // First, delete any existing superadmin
    await User.deleteOne({ email: "superadmin@gochop.com" });
    console.log("Deleted existing superadmin if any");

    // Generate unique phone number
    const phoneNumber = "+233000000001";

    // Check if phone number exists
    const phoneExists = await User.findOne({ phone: phoneNumber });
    if (phoneExists) {
      console.log("Phone number already exists, skipping super admin creation");
      return;
    }

    // Create password hash
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("superadmin123", salt);
    console.log("Password details:", {
      salt,
      hashedPassword,
      length: hashedPassword.length,
    });

    // Create admin document directly
    const adminDoc = {
      _id: new mongoose.Types.ObjectId(),
      name: "Super Admin",
      email: "superadmin@gochop.com",
      password: hashedPassword,
      role: "admin",
      status: "active",
      phone: phoneNumber,
      isEmailVerified: true,
      isSuperAdmin: true,
      isActive: true,
      createdAt: new Date(),
    };

    // Insert directly using MongoDB driver to bypass Mongoose middleware
    const result = await mongoose.connection
      .collection("users")
      .insertOne(adminDoc);
    console.log("Admin creation result:", {
      success: !!result.insertedId,
      id: result.insertedId,
      hashedPassword,
    });

    // Verify the user was created correctly
    const createdUser = await User.findOne({
      email: "superadmin@gochop.com",
    }).select("+password");
    console.log("Verification:", {
      exists: !!createdUser,
      passwordMatch: createdUser?.password === hashedPassword,
      storedHash: createdUser?.password,
    });

    // Test password match
    const testMatch = await bcrypt.compare(
      "superadmin123",
      createdUser.password
    );
    console.log("Test password match:", { testMatch });
  } catch (error) {
    console.error("Error seeding super admin:", error);
    throw error;
  }
};

module.exports = seedSuperAdmin;
