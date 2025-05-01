const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    return mongoose; // Return mongoose instance instead of connection
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
};

module.exports = connectDB;
