const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("../models/User");
const Rider = require("../models/Rider");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const Review = require("../models/Review");

const FIXED_RIDER_ID = new mongoose.Types.ObjectId("64b7f0c2f1c2a2b1c2d3e4f5");

async function seed() {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Wipe collections
  await Promise.all([
    User.deleteMany({}),
    Rider.deleteMany({}),
    Restaurant.deleteMany({}),
    MenuItem.deleteMany({}),
    Order.deleteMany({}),
    Review.deleteMany({}),
  ]);

  // Seed users
  const adminUser = await User.create({
    name: "Super Admin",
    email: "superadmin@gochop.com",
    password: "superadmin123",
    role: "admin",
    status: "active",
    phone: "+233000000001",
    isSuperAdmin: true,
    isEmailVerified: true,
    isActive: true,
    createdAt: new Date(),
  });
  const restaurantUser = await User.create({
    name: "Restaurant Admin",
    email: "restaurant@gochop.com",
    password: "restaurant123",
    role: "restaurant",
    status: "active",
    phone: "+233000000002",
    isSuperAdmin: false,
    address: "Restaurant Address",
    location: { type: "Point", coordinates: [0, 0] },
    isEmailVerified: true,
    isActive: true,
    createdAt: new Date(),
  });
  const riderUser = await User.create({
    name: "Delivery Rider",
    email: "rider@gochop.com",
    password: "rider123",
    role: "rider",
    status: "active",
    phone: "+233000000003",
    isSuperAdmin: false,
    address: "Rider Address",
    location: { type: "Point", coordinates: [0, 0] },
    isEmailVerified: true,
    isActive: true,
    createdAt: new Date(),
  });
  const customerUser = await User.create({
    name: "Regular User",
    email: "user@gochop.com",
    password: "user123",
    role: "customer",
    status: "active",
    phone: "+233000000004",
    isSuperAdmin: false,
    address: "User Address",
    location: { type: "Point", coordinates: [0, 0] },
    isEmailVerified: true,
    isActive: true,
    createdAt: new Date(),
  });

  // Seed rider
  const riderDoc = await Rider.create({
    _id: riderUser._id,
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

  // Seed restaurant
  const restaurant = await Restaurant.create({
    user: restaurantUser._id,
    name: "Test Restaurant",
    address: "123 Main St",
    location: { type: "Point", coordinates: [0, 0] },
    phone: "+233000000005",
    isActive: true,
    createdAt: new Date(),
    description: "A great place for testing food delivery.",
    averageRating: 5,
  });

  // Seed menu items
  const menuItems = [];
  for (let i = 1; i <= 5; i++) {
    menuItems.push({
      restaurant: restaurant._id,
      name: `Menu Item ${i}`,
      description: `Delicious item ${i}`,
      price: 10 + i,
      category: "Main Course",
      isAvailable: true,
      preparationTime: 15,
      image: "default-food-image.jpg",
    });
  }
  const insertedMenuItems = await MenuItem.insertMany(menuItems);

  // Seed orders for the test rider with different statuses
  const statuses = [
    "pending",
    "accepted",
    "preparing",
    "ready_for_pickup",
    "delivered",
    "cancelled",
  ];
  for (const status of statuses) {
    const orderData = {
      user: riderDoc._id,
      restaurant: restaurant._id,
      rider: riderDoc._id,
      items: [
        {
          name: `${status.charAt(0).toUpperCase() + status.slice(1)} Food`,
          price: 10 + Math.floor(Math.random() * 10),
          quantity: 1,
          subtotal: 10 + Math.floor(Math.random() * 10),
          menuItem:
            insertedMenuItems[
              Math.floor(Math.random() * insertedMenuItems.length)
            ]._id,
        },
      ],
      deliveryAddress: {
        address: `${status.charAt(0).toUpperCase() + status.slice(1)} Address`,
        location: {
          type: "Point",
          coordinates: [Math.random() * 2, Math.random() * 2],
        },
        instructions: `Instructions for ${status}`,
      },
      status,
      subtotal: 10,
      tax: 1,
      deliveryFee: 5,
      discount: 0,
      total: 16,
      paymentMethod: "cash",
      paymentStatus: "completed",
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 100000000)),
    };
    if (status === "delivered") {
      orderData.actualDeliveryTime = new Date();
    }
    await Order.create(orderData);
  }

  // After seeding, log all delivered orders for the rider
  const deliveredOrders = await Order.find({
    rider: riderDoc._id,
    status: "delivered",
  });
  console.log("\n--- Delivered Orders for Rider ---");
  deliveredOrders.forEach((order) => {
    console.log({
      _id: order._id,
      actualDeliveryTime: order.actualDeliveryTime,
      deliveryFee: order.deliveryFee,
      total: order.total,
      createdAt: order.createdAt,
      items: order.items,
    });
  });

  // Calculate and log expected earnings summary
  const totalEarnings = deliveredOrders.reduce(
    (sum, order) => sum + (order.deliveryFee || 0),
    0
  );
  const totalDeliveries = deliveredOrders.length;
  let totalMinutes = 0;
  deliveredOrders.forEach((order) => {
    if (order.createdAt && order.actualDeliveryTime) {
      totalMinutes +=
        (order.actualDeliveryTime - order.createdAt) / (1000 * 60);
    }
  });
  const totalHours = totalMinutes / 60;
  const averageEarning =
    totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0;
  const deliveryEarnings = totalEarnings;
  const tips = deliveredOrders.reduce(
    (sum, order) => sum + (order.tip || 0),
    0
  );
  const bonuses = deliveredOrders.reduce(
    (sum, order) => sum + (order.bonus || 0),
    0
  );

  console.log("\n--- Expected Earnings Summary ---");
  console.log({
    totalEarnings,
    totalDeliveries,
    averageEarning,
    totalHours,
    deliveryEarnings,
    tips,
    bonuses,
  });

  console.log("\nSeeding complete!");
  process.exit(0);
}

seed();
