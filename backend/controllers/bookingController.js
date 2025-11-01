// backend/controllers/bookingController.js
const Booking = require('../models/Booking');
const Flight = require('../models/Flight');
const Hotel = require('../models/Hotel');
const mongoose = require('mongoose');

// Helper to flatten arrays
const flatten = (arr) => [].concat(...arr);

/**
 * GET /api/bookings
 * Lists user's bookings
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
 * GET /api/bookings/booked-seats/:flightId
 * Returns unique booked seat IDs for a flight.
 */
exports.getBookedSeats = async (req, res) => {
  try {
    const { flightId } = req.params;
    const { travelClass } = req.query; // optional

    if (!flightId) return res.status(400).json({ message: 'Flight ID required' });

    const query = { item: flightId, type: 'flight' };
    if (travelClass) query.travelClass = travelClass;

    const bookings = await Booking.find(query).select('selectedSeats').lean();

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
    const { type, item, passengerData = [], selectedSeats = [], travelClass, totalAmount, travelDate } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!type || !item) return res.status(400).json({ message: 'Missing type or item' });

    // --- sanitize & normalize passengerData to match schema enums ---
    const normalizeType = (t) => {
      if (!t) return 'Adult';
      const s = String(t).toLowerCase();
      if (s.startsWith('inf')) return 'Infant';
      if (s.startsWith('child') || s === 'kid' || s === 'children') return 'Child';
      return 'Adult';
    };
    const normalizeGender = (g) => {
      if (!g) return 'Other';
      const s = String(g).toLowerCase();
      if (s.startsWith('m')) return 'Male';
      if (s.startsWith('f')) return 'Female';
      return 'Other';
    };

    // Validate required passenger fields and build sanitized array
    const sanitizedPassengers = (passengerData || []).map((p, idx) => {
      if (!p || !p.fullName || typeof p.age === 'undefined' || p.age === null || !p.gender) {
        throw { status: 400, message: `Passenger #${idx + 1} missing required fields (fullName, age, gender).` };
      }
      return {
        fullName: String(p.fullName).trim(),
        age: Number(p.age),
        gender: normalizeGender(p.gender),
        type: normalizeType(p.type),
      };
    });

    let flightDoc;
    if (type === 'flight') {
      flightDoc = await Flight.findById(item).lean();
      if (!flightDoc) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: 'Flight not found' });
      }

      const computedTotal = (typeof totalAmount === 'number' && !isNaN(totalAmount))
        ? totalAmount
        : ((flightDoc.price || 0) * Math.max(1, sanitizedPassengers.length));

      const existingBookings = await Booking.find({ item }).select('selectedSeats').lean();
      const existingSeats = flatten(existingBookings.map(b => b.selectedSeats || []));

      const conflicts = (selectedSeats || []).filter(s => existingSeats.includes(s));
      if (conflicts.length) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({ message: `Seats already booked: ${conflicts.join(', ')}`, conflicts });
      }

      const createdBooking = await Booking.create([{
        user: userId,
        type,
        item,
        passengerData: sanitizedPassengers,
        selectedSeats,
        travelClass,
        totalAmount: computedTotal,
        paymentStatus: 'Paid',
        travelDate: travelDate ? new Date(travelDate) : null,
      }], { session });

      await session.commitTransaction();
      session.endSession();

      let booking = await Booking.findById(createdBooking[0]._id).lean();
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

      return res.status(201).json({ success: true, booking });
    }

    // Hotel or other booking types
    const computedTotal = (typeof totalAmount === 'number' && !isNaN(totalAmount)) ? totalAmount : 0;

    const createdBooking = await Booking.create([{
      user: userId,
      type,
      item,
      passengerData: sanitizedPassengers,
      selectedSeats,
      travelClass,
      totalAmount: computedTotal,
      paymentStatus: 'Paid',
    }], { session });

    await session.commitTransaction();
    session.endSession();

    let booking = await Booking.findById(createdBooking[0]._id).lean();

    if (type === 'hotel') {
      const populatedItem = await Hotel.findById(booking.item)
        .select('name location checkIn checkOut price')
        .lean();
      booking.item = populatedItem;
    }

    return res.status(201).json({ success: true, booking });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    if (error && error.status && error.message) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error('❌ Error creating booking:', error);
    return res.status(500).json({ message: error.message || 'Server error creating booking' });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Booking id is required' });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.user.toString() !== userId.toString() && !req.user?.isAdmin) {
      return res.status(403).json({ message: 'Forbidden: you cannot cancel this booking' });
    }

    await Booking.findByIdAndDelete(id);

    return res.status(200).json({ success: true, message: 'Booking cancelled', bookingId: id });
  } catch (err) {
    console.error('❌ Error cancelling booking:', err);
    return res.status(500).json({ message: 'Server error cancelling booking' });
  }
};
