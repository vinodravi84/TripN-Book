// scripts/seedCities.js
require('dotenv').config();
const mongoose = require('mongoose');
const City = require('./models/City');
const cities = require('./cities_75.json'); // adjust path

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    await City.deleteMany({});
    await City.insertMany(
      Object.entries(cities).map(([name, code]) => ({ name, code }))
    );
    console.log(`Seeded ${Object.keys(cities).length} cities`);
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
