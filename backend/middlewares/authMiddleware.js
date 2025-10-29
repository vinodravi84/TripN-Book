const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;
    console.log(`💠 Auth middleware passed for user: ${user.email}`);
    next();
  } catch (err) {
    console.error('❌ Auth middleware error:', err.message);

    // Detect if token is expired
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }

    res.status(401).json({ error: 'Invalid token' });
  }
};
