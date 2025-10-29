const express = require('express');
const { getBookings, createBooking,getBookedSeats,cancelBooking } = require('../controllers/bookingController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', protect, getBookings);
router.get('/booked-seats/:flightId', getBookedSeats);
router.post('/', protect, createBooking);
router.delete('/:id', protect, cancelBooking);

module.exports = router;
