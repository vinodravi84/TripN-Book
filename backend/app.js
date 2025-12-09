const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const flightRoutes = require('./routes/flightRoutes');
const hotelRoutes = require('./routes/hotelRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const citiesRouter = require('./routes/cityRoutes');
const assistantRoutes = require('./routes/assistantRoutes.js');

const app = express();

// Full unrestricted CORS
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/cities', citiesRouter);
app.use("/api/assistant", assistantRoutes);

module.exports = app;
