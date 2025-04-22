const NodeGeocoder = require("node-geocoder");
const config = require("../config/config");

const options = {
  provider: config.geocoder.provider,
  apiKey: config.geocoder.apiKey,
  formatter: null,
};

const geocoder = NodeGeocoder(options);

module.exports = geocoder;
