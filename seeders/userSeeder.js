const bcrypt = require("bcryptjs");
const User = require("../models/User");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Rider = require("../models/Rider");

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

    // Create a test order for the rider
    const riderUser = await User.findOne({ email: "rider@gochop.com" });
    await Rider.deleteOne({
      $or: [{ user: riderUser._id }, { nationalId: "RID123456" }],
    });
    let riderDoc = await Rider.findOne({ user: riderUser._id });
    if (!riderDoc) {
      riderDoc = await Rider.create({
        user: riderUser._id,
        firstName: "Delivery",
        lastName: "Rider",
        dateOfBirth: new Date("1990-01-01"),
        nationalId: "RID123456",
        nationalIdPhoto: "default-id.png",
        vehicleType: "motorcycle",
        vehicleDetails: {
          make: "Honda",
          model: "Wave",
          year: 2020,
          color: "Red",
          licensePlate: "GR1234-20",
        },
        status: "online",
        isAvailable: true,
        isVerified: true,
        isActive: true,
      });
    }
    await Order.create({
      user: riderUser._id,
      restaurant: new mongoose.Types.ObjectId("68110e17d2a6861aa5256b99"),
      rider: riderDoc._id,
      items: [
        {
          name: "Test Food",
          price: 10,
          quantity: 1,
          subtotal: 10,
          menuItem: new mongoose.Types.ObjectId(),
        },
      ],
      deliveryAddress: {
        address: "Test Address",
        location: { type: "Point", coordinates: [0, 0] },
        instructions: "Leave at door",
      },
      status: "ready_for_pickup",
      subtotal: 10,
      tax: 1,
      deliveryFee: 5,
      discount: 0,
      total: 16,
      paymentMethod: "cash",
      paymentStatus: "pending",
      createdAt: new Date(),
    });
    await Order.create({
      user: riderUser._id,
      restaurant: new mongoose.Types.ObjectId("68110e17d2a6861aa5256b99"),
      rider: riderDoc._id,
      items: [
        {
          name: "Active Delivery Food",
          price: 15,
          quantity: 2,
          subtotal: 30,
          menuItem: new mongoose.Types.ObjectId(),
        },
      ],
      deliveryAddress: {
        address: "Active Delivery Address",
        location: { type: "Point", coordinates: [1, 1] },
        instructions: "Ring the bell",
      },
      status: "accepted",
      subtotal: 30,
      tax: 3,
      deliveryFee: 7,
      discount: 0,
      total: 40,
      paymentMethod: "cash",
      paymentStatus: "pending",
      createdAt: new Date(),
    });

    // Patch: Assign all existing orders to the test rider and set status to 'delivered' if not already assigned
    const allOrders = await Order.find({ rider: null });
    for (const order of allOrders) {
      order.rider = riderDoc._id;
      order.status = "delivered";
      order.actualDeliveryTime = new Date();
      await order.save();
    }
    console.log(
      `Patched ${allOrders.length} orders to assign to test rider and set as delivered.`
    );

    console.log("User seeding completed successfully");
  } catch (error) {
    console.error("Error in user seeding:", error);
    throw error;
  }
};

module.exports = seedUsers;
