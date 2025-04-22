const mongoose = require("mongoose");
const config = require("../config/config");

const RiderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  firstName: {
    type: String,
    required: [true, "Please add a first name"],
  },
  lastName: {
    type: String,
    required: [true, "Please add a last name"],
  },
  dateOfBirth: {
    type: Date,
    required: [true, "Please add date of birth"],
  },
  nationalId: {
    type: String,
    required: [true, "Please add a national ID number"],
    unique: true,
  },
  nationalIdPhoto: {
    type: String,
    required: [true, "Please upload a photo of your national ID"],
  },
  profilePhoto: {
    type: String,
    default: "default-rider.png",
  },
  vehicleType: {
    type: String,
    enum: ["motorcycle", "bicycle", "car", "scooter"],
    required: [true, "Please specify vehicle type"],
  },
  vehicleDetails: {
    make: String,
    model: String,
    year: Number,
    color: String,
    licensePlate: String,
  },
  vehicleRegistrationPhoto: String,
  drivingLicense: {
    number: String,
    expiryDate: Date,
    photo: String,
  },
  currentLocation: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      index: "2dsphere",
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  status: {
    type: String,
    enum: Object.values(config.riderStatuses),
    default: config.riderStatuses.OFFLINE,
  },
  isAvailable: {
    type: Boolean,
    default: false,
  },
  currentOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    default: null,
  },
  averageRating: {
    type: Number,
    min: 1,
    max: 5,
    default: 5,
  },
  numberOfRatings: {
    type: Number,
    default: 0,
  },
  totalEarnings: {
    type: Number,
    default: 0,
  },
  bankDetails: {
    accountName: String,
    accountNumber: String,
    bankName: String,
    swiftCode: String,
  },
  activeAreas: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
    },
  ],
  isVerified: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  documents: [
    {
      name: String,
      fileName: String,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
      isVerified: {
        type: Boolean,
        default: false,
      },
    },
  ],
  fcmToken: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Create index for geospatial queries
RiderSchema.index({ "currentLocation.coordinates": "2dsphere" });

// Method to update rider location
RiderSchema.methods.updateLocation = async function (coordinates) {
  this.currentLocation = {
    type: "Point",
    coordinates,
    lastUpdated: Date.now(),
  };
  return this.save();
};

// Method to calculate distance between rider and destination
RiderSchema.methods.distanceTo = function (coordinates) {
  // Distance calculation using the Haversine formula
  const toRadians = (degree) => degree * (Math.PI / 180);

  const lat1 = toRadians(this.currentLocation.coordinates[1]);
  const lon1 = toRadians(this.currentLocation.coordinates[0]);
  const lat2 = toRadians(coordinates[1]);
  const lon2 = toRadians(coordinates[0]);

  const R = 6371; // Earth's radius in km

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in km
};

// Method to calculate estimated arrival time
RiderSchema.methods.estimateArrivalTime = function (
  coordinates,
  averageSpeed = 20
) {
  // averageSpeed in km/h
  const distance = this.distanceTo(coordinates);
  const timeInHours = distance / averageSpeed;
  return timeInHours * 60; // Return time in minutes
};

module.exports = mongoose.model("Rider", RiderSchema);
