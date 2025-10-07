// models/Flight.js
const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema({
  flightNumber: { type: String, required: true },
  airline:       { type: String, required: true },
  logo:          { type: String, required: true },
  from:          { type: String, required: true },
  departureCityCode: { type: String, required: true },
  to:            { type: String, required: true },
  arrivalCityCode:   { type: String, required: true },
  departureTime: { type: String, required: true },
  arrivalTime:   { type: String, required: true },
  duration:      { type: String, required: true },
  seats: {
    economy:  { type: Number, required: true },
    business: { type: Number },  // optional for non-ATR
    first:    { type: Number }   // optional for non-ATR
  },
  price:         { type: Number, required: true },
  terminal:      { type: String, required: true },
  gate:          { type: String, required: true },
  aircraft: {
    make:  { type: String, required: true },
    model: { type: String, required: true }
  }
});

module.exports = mongoose.model('Flight', flightSchema);