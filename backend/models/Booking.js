const mongoose = require('mongoose');

const passengerSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  type: { type: String, enum: ['Adult', 'Child', 'Infant'], required: true },
});

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['flight', 'hotel'], required: true },
    item: { type: mongoose.Schema.Types.ObjectId, required: true }, // Flight or hotel ID
    passengerData: [passengerSchema],
    selectedSeats: [String],
    travelClass: { type: String, default: 'Economy' },
    totalAmount: { type: Number, required: true },
    paymentStatus: { type: String, enum: ['Paid', 'Pending'], default: 'Paid' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
