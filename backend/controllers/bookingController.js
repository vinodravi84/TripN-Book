const Booking = require('../models/Booking');
const Flight = require('../models/Flight');

// Get all bookings for logged-in user
exports.getBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, bookings });
  } catch (error) {
    console.error('❌ Error fetching bookings:', error);
    res.status(500).json({ message: 'Server error fetching bookings' });
  }
};

// Create booking (flights or hotels)
exports.createBooking = async (req, res) => {
  try {
    const { type, item, passengerData = [], selectedSeats = [], travelClass, totalAmount } = req.body;

    if (!req.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    if (!type || !item) return res.status(400).json({ message: 'Missing booking type or item ID' });

    // For flight booking, validate seat availability
    if (type === 'flight') {
      const flight = await Flight.findById(item);
      if (!flight) return res.status(404).json({ message: 'Flight not found' });

      flight.bookedSeats = flight.bookedSeats || [];
      const alreadyBooked = selectedSeats.filter(seat => flight.bookedSeats.includes(seat));
      if (alreadyBooked.length > 0) {
        return res.status(400).json({ message: `Seats already booked: ${alreadyBooked.join(', ')}` });
      }

      // Add new booked seats
      flight.bookedSeats.push(...selectedSeats);
      await flight.save();
    }

    // Create booking record
    const booking = await Booking.create({
      user: req.user.id,
      type,
      item,
      passengerData,
      selectedSeats,
      travelClass,
      totalAmount,
      paymentStatus: 'Paid',
      date: new Date(),
    });

    res.status(201).json({ success: true, message: 'Booking successful', booking });
  } catch (error) {
    console.error('❌ Error creating booking:', error);
    res.status(500).json({ message: 'Booking failed', error: error.message });
  }
};
