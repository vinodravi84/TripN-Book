// seed.js (put this at C:\Users\Vinod Ravi\Desktop\TripNBook\seed.js)
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./db');       // make sure ./db.js exports your connectDB()
const Flight = require('./models/Flight'); // adjust path if your model lives elsewhere

const flights = require('./flights_50000_capacity_exact.json'); 
// or build/generate them here

const seedFlights = async () => {
  try {
    await connectDB();
    await Flight.deleteMany();
    await Flight.insertMany(flights);
    console.log('✅ Flights seeded successfully');
    process.exit();
  } catch (err) {
    console.error('❌ Error seeding flights:', err);
    process.exit(1);
  }
};

seedFlights();
