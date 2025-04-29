const mongoose = require("mongoose");
const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const Review = require("../models/Review");
require("dotenv").config();

const seedRestaurantData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Find the restaurant and admin user
    const admin = await User.findOne({ email: "restaurant@gochop.com" });
    if (!admin) {
      console.log("Please run seedRestaurantWithAdmin first");
      return;
    }

    const restaurant = await Restaurant.findOne({ user: admin._id });
    if (!restaurant) {
      console.log("Restaurant not found");
      return;
    }

    // Seed Menu Items
    const menuCategories = ["Starters", "Main Course", "Desserts", "Beverages"];
    const menuItems = [];

    for (const category of menuCategories) {
      for (let i = 1; i <= 5; i++) {
        menuItems.push({
          restaurant: restaurant._id,
          name: `${category} Item ${i}`,
          description: `Delicious ${category.toLowerCase()} item ${i}`,
          price: Math.floor(Math.random() * 30) + 5,
          category,
          isAvailable: true,
          preparationTime: 15,
          image: "default-food-image.jpg",
        });
      }
    }

    await MenuItem.deleteMany({ restaurant: restaurant._id });
    const createdMenuItems = await MenuItem.insertMany(menuItems);
    console.log(`Created ${createdMenuItems.length} menu items`);

    // Seed Customer Users
    const customers = [];
    for (let i = 1; i <= 10; i++) {
      customers.push({
        name: `Customer ${i}`,
        email: `customer${i}@example.com`,
        phone: `+1234567${i.toString().padStart(3, "0")}`,
        password: "Customer@123",
        role: "customer",
        address: `${i} Customer Street, City`,
        isActive: true,
      });
    }

    await User.deleteMany({ role: "customer" });
    const createdCustomers = await User.insertMany(customers);
    console.log(`Created ${createdCustomers.length} customers`);

    // Seed Orders
    const orderStatuses = [
      "pending",
      "accepted",
      "preparing",
      "ready_for_pickup",
      "delivered",
      "cancelled",
    ];
    const orders = [];

    for (let i = 0; i < 50; i++) {
      const customer =
        createdCustomers[Math.floor(Math.random() * createdCustomers.length)];
      const itemCount = Math.floor(Math.random() * 5) + 1;
      const orderItems = [];
      let subtotal = 0;

      for (let j = 0; j < itemCount; j++) {
        const menuItem =
          createdMenuItems[Math.floor(Math.random() * createdMenuItems.length)];
        const quantity = Math.floor(Math.random() * 3) + 1;
        const itemSubtotal = menuItem.price * quantity;
        orderItems.push({
          menuItem: menuItem._id,
          name: menuItem.name,
          price: menuItem.price,
          quantity,
          subtotal: itemSubtotal,
          customizations: [],
        });
        subtotal += itemSubtotal;
      }

      const deliveryFee = 5;
      const tax = subtotal * 0.1;
      const total = subtotal + deliveryFee + tax;

      // Create order with random date in last 30 days
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 30));

      orders.push({
        restaurant: restaurant._id,
        user: customer._id,
        items: orderItems,
        status: orderStatuses[Math.floor(Math.random() * orderStatuses.length)],
        deliveryAddress: {
          address: customer.address,
          location: {
            type: "Point",
            coordinates: [
              -73.935242 + (Math.random() - 0.5) * 0.1,
              40.73061 + (Math.random() - 0.5) * 0.1,
            ],
          },
          instructions: "Please ring the doorbell",
        },
        subtotal,
        deliveryFee,
        tax,
        total,
        paymentMethod: "cash",
        paymentStatus: "completed",
        statusHistory: [
          {
            status: "pending",
            time: orderDate,
            note: "Order placed",
          },
        ],
        createdAt: orderDate,
      });
    }

    await Order.deleteMany({ restaurant: restaurant._id });
    const createdOrders = await Order.insertMany(orders);
    console.log(`Created ${createdOrders.length} orders`);

    // Seed Reviews
    const reviews = [];
    const completedOrders = createdOrders.filter(
      (order) => order.status === "delivered"
    );

    for (const order of completedOrders) {
      if (Math.random() > 0.3) {
        // 70% chance of review
        reviews.push({
          restaurant: restaurant._id,
          user: order.user,
          rating: Math.floor(Math.random() * 3) + 3, // 3-5 stars
          comment: `Great food and service! Order #${order._id}`,
          order: order._id,
        });
      }
    }

    await Review.deleteMany({ restaurant: restaurant._id });
    const createdReviews = await Review.insertMany(reviews);
    console.log(`Created ${createdReviews.length} reviews`);

    // Update restaurant rating
    const avgRating =
      reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length;
    await Restaurant.findByIdAndUpdate(restaurant._id, {
      averageRating: avgRating,
      ratingCount: reviews.length,
    });

    console.log("Successfully seeded all restaurant data!");
  } catch (error) {
    console.error("Error seeding restaurant data:", error);
  } finally {
    await mongoose.disconnect();
  }
};

seedRestaurantData();
