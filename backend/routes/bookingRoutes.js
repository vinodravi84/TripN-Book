const express = require('express');
const { getBookings, createBooking,getBookedSeats } = require('../controllers/bookingController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', protect, getBookings);
router.get('/booked-seats/:flightId', getBookedSeats);
router.post('/', protect, createBooking);

module.exports = router;
