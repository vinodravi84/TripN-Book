// controllers/bookingController.js
const Booking = require('../models/Booking');
const Flight = require('../models/Flight');
const Hotel = require('../models/Hotel');
const mongoose = require('mongoose');

// Helper to flatten arrays
const flatten = (arr) => [].concat(...arr);

/**
 * GET /api/bookings
 * (unchanged) - lists user's bookings
 */
exports.getBookings = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const bookings = await Booking.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    const populatedAndNormalized = await Promise.all(
      bookings.map(async (b) => {
        let populatedBooking = { ...b };

        if (b.type === 'flight') {
          const item = await Flight.findById(b.item)
            .select('flightNumber airline from to departureTime arrivalTime price aircraft.make aircraft.model')
            .lean();

          populatedBooking.item = item;

          if (item) {
            populatedBooking.flight = {
              flightNumber: item.flightNumber || 'N/A',
              airline: item.airline || 'N/A',
              from: item.from || 'N/A',
              to: item.to || 'N/A',
              departureAt: item.departureTime || null,
              arrivalAt: item.arrivalTime || null,
              price: item.price || 'N/A',
              aircraft: item.aircraft || {},
            };
          } else {
            populatedBooking.flight = {
              flightNumber: 'N/A',
              airline: 'N/A',
              from: 'N/A',
              to: 'N/A',
              departureAt: null,
              arrivalAt: null,
              price: 'N/A',
              aircraft: {},
            };
          }
        } else if (b.type === 'hotel') {
          const item = await Hotel.findById(b.item)
            .select('name location checkIn checkOut price')
            .lean();
          populatedBooking.item = item;
        }

        return populatedBooking;
      })
    );

    return res.status(200).json({ success: true, bookings: populatedAndNormalized });
  } catch (error) {
    console.error('❌ Error fetching bookings:', error);
    return res.status(500).json({ message: 'Server error fetching bookings' });
  }
};

/**
 * NEW: GET /api/bookings/booked-seats/:flightId
 * Returns unique booked seat IDs for a flight.
 * Accepts optional query param `travelClass` to filter seats for a specific class.
 */
exports.getBookedSeats = async (req, res) => {
  try {
    const { flightId } = req.params;
    const { travelClass } = req.query; // optional

    if (!flightId) return res.status(400).json({ message: 'Flight ID required' });

    // Find bookings for this flight (optionally filter by travelClass)
    const query = { item: flightId, type: 'flight' };
    if (travelClass) query.travelClass = travelClass;

    const bookings = await Booking.find(query).select('selectedSeats').lean();

    // Flatten and dedupe
    const bookedSeats = Array.from(new Set(flatten(bookings.map(b => b.selectedSeats || []))));

    return res.status(200).json({ success: true, bookedSeats });
  } catch (err) {
    console.error('❌ Error fetching booked seats:', err);
    return res.status(500).json({ message: 'Server error fetching booked seats' });
  }
};

/**
 * POST /api/bookings
 * Create a new booking (flight or hotel)
 * Flight bookings validate seat conflicts and return 409 on conflicts
 */
exports.createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const userId = req.user?._id || req.user?.id;
    const { type, item, passengerData = [], selectedSeats = [], travelClass, totalAmount } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!type || !item) return res.status(400).json({ message: 'Missing type or item' });

    let flightDoc;
    if (type === 'flight') {
      flightDoc = await Flight.findById(item).lean();
      if (!flightDoc) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Flight not found' });
      }

      // Gather existing seats for this flight (and optionally same travelClass if desired)
      const existingBookings = await Booking.find({ item }).select('selectedSeats').lean();
      const existingSeats = flatten(existingBookings.map(b => b.selectedSeats || []));

      // detect conflicts
      const conflicts = selectedSeats.filter(s => existingSeats.includes(s));
      if (conflicts.length) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({ message: `Seats already booked: ${conflicts.join(', ')}`, conflicts });
      }
    }

    // create booking
    const createdBooking = await Booking.create([{
      user: userId,
      type,
      item,
      passengerData,
      selectedSeats,
      travelClass,
      totalAmount,
      paymentStatus: 'Paid',
    }], { session });

    await session.commitTransaction();
    session.endSession();

    // Populate returned booking for response (same as before)
    let booking = await Booking.findById(createdBooking[0]._id).lean();

    if (type === 'flight') {
      const populatedItem = await Flight.findById(booking.item)
        .select('flightNumber airline from to departureTime arrivalTime price aircraft.make aircraft.model')
        .lean();
      booking.item = populatedItem;
      booking.flight = populatedItem ? {
        flightNumber: populatedItem.flightNumber,
        airline: populatedItem.airline,
        from: populatedItem.from,
        to: populatedItem.to,
        departureAt: populatedItem.departureTime,
        arrivalAt: populatedItem.arrivalTime,
        price: populatedItem.price,
        aircraft: populatedItem.aircraft || {},
      } : null;
    } else if (type === 'hotel') {
      const populatedItem = await Hotel.findById(booking.item)
        .select('name location checkIn checkOut price')
        .lean();
      booking.item = populatedItem;
    }

    return res.status(201).json({ success: true, booking });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ Error creating booking:', error);
    // If you want to expose the message, ensure it doesn't leak sensitive info
    return res.status(500).json({ message: error.message || 'Server error creating booking' });
  }
};
