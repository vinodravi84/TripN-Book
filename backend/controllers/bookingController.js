// controllers/bookingController.js
const Booking = require('../models/Booking');
const Flight = require('../models/Flight');
const Hotel = require('../models/Hotel'); // Assuming Hotel model exists; adjust if needed
const mongoose = require('mongoose');

// Helper to flatten arrays
const flatten = (arr) => [].concat(...arr);

/**
 * GET /api/bookings
 * Get all bookings for the logged-in user
 * Flight bookings are normalized to always have `flight` object
 */
exports.getBookings = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // Fetch all bookings (lean for efficiency)
    const bookings = await Booking.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    // Manually populate and normalize for each booking based on type
    const populatedAndNormalized = await Promise.all(
      bookings.map(async (b) => {
        let populatedBooking = { ...b };

        if (b.type === 'flight') {
          // Populate flight item manually
          const item = await Flight.findById(b.item)
            .select('flightNumber airline from to departureTime arrivalTime price aircraft.make aircraft.model')
            .lean();

          populatedBooking.item = item;

          // Normalize flight object
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
            // Fallback if item not found
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
          // Optionally populate hotel item manually (adjust select as needed)
          const item = await Hotel.findById(b.item)
            .select('name location checkIn checkOut price') // Example hotel fields
            .lean();
          populatedBooking.item = item;
          // Normalize hotel if needed, e.g., populatedBooking.hotel = { ... }
        }
        // For other types, item remains as ID

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
 * POST /api/bookings
 * Create a new booking (flight or hotel)
 * Flight bookings validate seat conflicts
 */
exports.createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const userId = req.user?._id || req.user?.id;
    const { type, item, passengerData = [], selectedSeats = [], travelClass, totalAmount } = req.body;

    if (!userId) throw new Error('Unauthorized');
    if (!type || !item) throw new Error('Missing type or item');

    let flightDoc;
    if (type === 'flight') {
      flightDoc = await Flight.findById(item).lean();
      if (!flightDoc) throw new Error('Flight not found');

      const existingSeats = flatten(
        (await Booking.find({ item }).select('selectedSeats').lean()).map(b => b.selectedSeats || [])
      );
      const conflicts = selectedSeats.filter(s => existingSeats.includes(s));
      if (conflicts.length) throw new Error(`Seats already booked: ${conflicts.join(', ')}`);
    }

    // Note: Using flatten helper for existingSeats
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

    // Fetch the created booking and manually populate based on type
    let booking = await Booking.findById(createdBooking[0]._id).lean();

    if (type === 'flight') {
      // Populate flight item manually
      const populatedItem = await Flight.findById(booking.item)
        .select('flightNumber airline from to departureTime arrivalTime price aircraft.make aircraft.model')
        .lean();
      booking.item = populatedItem;

      // Normalize flight field
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
      // Optionally populate hotel
      const populatedItem = await Hotel.findById(booking.item)
        .select('name location checkIn checkOut price') // Example
        .lean();
      booking.item = populatedItem;
      // Normalize hotel if needed
    }

    return res.status(201).json({ success: true, booking });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ Error creating booking:', error);
    return res.status(500).json({ message: error.message });
  }
};