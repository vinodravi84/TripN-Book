const Booking = require('../models/Booking');

exports.getBookings = async (req, res) => {
  const bookings = await Booking.find({ user: req.user.id });
  res.json(bookings);
};

exports.createBooking = async (req, res) => {
  const booking = await Booking.create({ ...req.body, user: req.user.id });
  res.json(booking);
};
