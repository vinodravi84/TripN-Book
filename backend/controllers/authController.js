// controllers/authController.js

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// Helper to sign a token
const signToken = userId =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1) require all fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }

    // 2) check if email already in use
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    // 3) create & save (pre('save') on model will hash password)
    const user = new User({ name, email, password });
    await user.save();

    // 4) issue a JWT
    const token = signToken(user._id);

    // 5) respond with safe user data + token
    res.status(201).json({
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email
      },
      token
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1) require both fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // 2) fetch user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // 3) compare passwords
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // 4) issue a JWT
    const token = signToken(user._id);

    // 5) respond with safe user data + token
    res.json({
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email
      },
      token
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
};
