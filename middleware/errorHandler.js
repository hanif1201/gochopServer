const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log to console for development
  console.error(err.stack);

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    const message = `Resource not found with id of ${err.value}`;
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${
      field.charAt(0).toUpperCase() + field.slice(1)
    } already exists`;
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors).map((val) => val.message);
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    error = { message: "Invalid token", statusCode: 401 };
  }

  if (err.name === "TokenExpiredError") {
    error = { message: "Token expired", statusCode: 401 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Server Error",
  });
};

module.exports = errorHandler;
