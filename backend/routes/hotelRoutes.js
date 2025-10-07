const express = require('express');
const { getHotels, createHotel } = require('../controllers/hotelController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', getHotels);
router.post('/', protect, createHotel); // Admin-only ideally

module.exports = router;
