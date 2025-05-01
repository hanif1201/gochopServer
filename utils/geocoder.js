const NodeGeocoder = require("node-geocoder");

// Debug logging
console.log("Geocoder Environment Variables:", {
  GEOCODER_PROVIDER: process.env.GEOCODER_PROVIDER,
  GEOCODER_API_KEY: process.env.GEOCODER_API_KEY,
});

const options = {
  provider: process.env.GEOCODER_PROVIDER,
  apiKey: process.env.GEOCODER_API_KEY,
  httpAdapter: "https",
  formatter: null,
};

const geocoder = NodeGeocoder(options);

module.exports = geocoder;
