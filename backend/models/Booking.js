const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['flight', 'hotel'] },
  item: { type: mongoose.Schema.Types.ObjectId },
  date: Date,
});

module.exports = mongoose.model('Booking', bookingSchema);
