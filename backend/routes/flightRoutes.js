const express = require('express');
const { getFlights } = require('../controllers/flightController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/', getFlights);
router.get('/search', getFlights);        // <-- add this line

//router.post('/', protect, createFlight); // Admin-only ideally

module.exports = router;
