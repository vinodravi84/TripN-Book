const Hotel = require('../models/Hotel');

exports.getHotels = async (req, res) => {
  const hotels = await Hotel.find();
  res.json(hotels);
};

exports.createHotel = async (req, res) => {
  const hotel = await Hotel.create(req.body);
  res.json(hotel);
};
