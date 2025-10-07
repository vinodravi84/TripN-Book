// controllers/flightController.js
const Flight = require('../models/Flight');

// @desc    Get all flights or search flights
// @route   GET /api/flight
// @access  Public
const getFlights = async (req, res) => {
  try {
    const { fromCity, toCity } = req.query;

    // Build query object
    const query = {};

    // Match airport codes exactly (case‑insensitive)
    if (fromCity) {
      query.departureCityCode = { $regex: new RegExp(`^${fromCity}$`, 'i') };
    }
    if (toCity) {
      query.arrivalCityCode = { $regex: new RegExp(`^${toCity}$`, 'i') };
    }

    const flights = await Flight.find(query);
    return res.json(flights);
  } catch (error) {
    console.error('Error fetching flights:', error);
    return res.status(500).json({ error: 'Failed to fetch flights' });
  }
};

// @desc    Create a new flight
// @route   POST /api/flight
// @access  Private (admin-only ideally)
const createFlight = async (req, res) => {
  try {
    const { from, to, departureTime, arrivalTime, airline, price, seats } = req.body;

    // Validate required fields
    if (!from || !to || !departureTime || !arrivalTime || !airline || !price || !seats) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const flight = new Flight(req.body);
    const savedFlight = await flight.save();
    return res.status(201).json(savedFlight);
  } catch (error) {
    console.error('Error creating flight:', error);
    return res.status(400).json({ error: 'Failed to create flight', details: error.message });
  }
};

module.exports = {
  getFlights,
  createFlight,
};
