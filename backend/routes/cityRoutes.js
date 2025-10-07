// routes/cities.js
const express = require('express');
const City = require('../models/City');
const router = express.Router();

// GET /api/cities?q=del
router.get('/', async (req, res) => {
  const q = req.query.q || '';
  const regex = new RegExp(q, 'i');  // matches anywhere, case-insensitive

  const results = await City.find({ name: regex })
                            .limit(10)
                            .sort({ name: 1 })
                            .lean();

  res.json(results);
});

module.exports = router;
