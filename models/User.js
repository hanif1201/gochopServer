const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config/config");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please add a name"],
    trim: true,
    maxlength: [50, "Name can not be more than 50 characters"],
  },
  email: {
    type: String,
    required: [true, "Please add an email"],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Please add a valid email",
    ],
  },
  phone: {
    type: String,
    required: [true, "Please add a phone number"],
    unique: true,
  },
  password: {
    type: String,
    required: [true, "Please add a password"],
    minlength: [6, "Password must be at least 6 characters"],
    select: false,
  },
  role: {
    type: String,
    enum: Object.values(config.roles),
    default: config.roles.CUSTOMER,
  },
  address: {
    type: String,
    required: function () {
      return this.role === config.roles.CUSTOMER;
    },
  },
  savedAddresses: [
    {
      name: {
        type: String,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
      location: {
        type: {
          type: String,
          enum: ["Point"],
        },
        coordinates: {
          type: [Number],
          index: "2dsphere",
        },
      },
    },
  ],
  location: {
    type: {
      type: String,
      enum: ["Point"],
    },
    coordinates: {
      type: [Number],
      index: "2dsphere",
    },
  },
  profilePicture: {
    type: String,
    default: "default-avatar.png",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  fcmToken: {
    type: String,
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  emailVerified: {
    type: Boolean,
    default: false,
  },
  phoneVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isSuperAdmin: {
    type: Boolean,
    default: false,
  },
  refreshTokens: [
    {
      token: { type: String },
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

// Encrypt password using bcrypt
UserSchema.pre("save", async function (next) {
  console.log("Pre-save hook:", {
    isModified: this.isModified("password"),
    password: !!this.password,
  });

  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(this.password, salt);
    console.log("Password hashing:", {
      originalLength: this.password.length,
      hashedLength: hashedPassword.length,
    });
    this.password = hashedPassword;
    next();
  } catch (error) {
    console.error("Password hashing error:", error);
    next(error);
  }
});

// Sign JWT and return token
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, config.jwtSecret, {
    expiresIn: config.jwtExpire,
  });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  console.log("Matching password:", {
    enteredPassword: !!enteredPassword,
    hashedPassword: !!this.password,
    enteredLength: enteredPassword?.length,
    hashedLength: this.password?.length,
  });

  try {
    const isMatch = await bcrypt.compare(enteredPassword, this.password);
    console.log("Password comparison result:", { isMatch });
    return isMatch;
  } catch (error) {
    console.error("Password comparison error:", error);
    throw error;
  }
};

module.exports = mongoose.model("User", UserSchema);
