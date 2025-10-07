const express = require('express');
const { getFlights, createFlight } = require('../controllers/flightController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', getFlights);
router.post('/', protect, createFlight); // Admin-only ideally

module.exports = router;
