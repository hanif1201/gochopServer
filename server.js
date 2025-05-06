const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const http = require("http");
const socketIO = require("socket.io");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const seedUsers = require("./seeders/userSeeder");

// Load env vars
dotenv.config();

// Route files
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const restaurantRoutes = require("./routes/restaurantRoutes");
const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");
const riderRoutes = require("./routes/riderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const deliveriesRoutes = require("./routes/deliveriesRoutes");
const earningsRoutes = require("./routes/earningsRoutes");

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// Dev logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Static folder
app.use("/uploads", express.static("uploads"));

// Add before mounting other routers
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to GoChop API",
    documentation:
      "Available routes: /api/auth, /api/users, /api/restaurants, /api/menu, /api/orders, /api/riders, /api/admin",
  });
});

// Mount routers
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/riders", riderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/deliveries", deliveriesRoutes);
app.use("/api/earnings", earningsRoutes);

// Error handler middleware
app.use(errorHandler);

// Socket.io connection
io.on("connection", (socket) => {
  console.log("New client connected");

  // Join a room based on user type and ID
  socket.on("join", ({ type, id }) => {
    socket.join(`${type}_${id}`);
    console.log(`Client joined room: ${type}_${id}`);
  });

  // Listen for new orders
  socket.on("newOrder", (order) => {
    // Emit to restaurant room
    io.to(`restaurant_${order.restaurant}`).emit("orderReceived", order);
  });

  // Listen for order status updates
  socket.on("updateOrderStatus", (data) => {
    // Emit to user and rider rooms
    io.to(`user_${data.userId}`).emit("orderStatusUpdated", data);
    if (data.riderId) {
      io.to(`rider_${data.riderId}`).emit("orderStatusUpdated", data);
    }
  });

  // Listen for rider location updates
  socket.on("updateRiderLocation", (data) => {
    // Emit to user waiting for this rider
    io.to(`user_${data.userId}`).emit("riderLocationUpdated", data);
  });

  // Disconnect event
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB first
    const mongoose = await connectDB();
    console.log("MongoDB Connected:", mongoose.connection.host);

    // Only proceed with seeding after successful connection
    if (mongoose.connection.readyState === 1) {
      console.log("Starting user seeding...");
      await seedUsers();
      console.log("User seeding completed");
    }

    server.listen(PORT, () => {
      console.log(
        `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
      );
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
};

startServer();

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
