const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  preferences: {
    preferredAirlines: [String],
    seatPreferences: { type: String, enum: ['window', 'aisle', 'middle'] },
    travelClass: { type: String, enum: ['Economy', 'Business', 'First'] },
    mealPreferences: [String],
    budgetRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 10000 }
    }
  },
  travelHistory: [{
    type: { type: String, enum: ['flight', 'hotel'] },
    route: String,
    date: Date,
    price: Number,
    satisfaction: { type: Number, min: 1, max: 5 }
  }],
  frequentRoutes: [{
    from: String,
    to: String,
    frequency: { type: Number, default: 1 }
  }]
}, { timestamps: true });

// Indexes for efficient queries
userProfileSchema.index({ userId: 1 });
userProfileSchema.index({ 'frequentRoutes.from': 1, 'frequentRoutes.to': 1 });

// Static method to update frequent routes
userProfileSchema.statics.updateFrequentRoute = async function(userId, from, to) {
  const routeKey = `${from}-${to}`;

  await this.findOneAndUpdate(
    { userId },
    {
      $inc: { 'frequentRoutes.$[elem].frequency': 1 },
      $setOnInsert: {
        preferences: {},
        travelHistory: [],
        frequentRoutes: [{ from, to, frequency: 1 }]
      }
    },
    {
      arrayFilters: [{ 'elem.from': from, 'elem.to': to }],
      upsert: true,
      new: true
    }
  );
};

// Instance method to add travel history
userProfileSchema.methods.addTravelHistory = function(type, route, date, price, satisfaction = null) {
  this.travelHistory.push({
    type,
    route,
    date,
    price,
    satisfaction
  });

  // Keep only last 50 travel history entries
  if (this.travelHistory.length > 50) {
    this.travelHistory = this.travelHistory.slice(-50);
  }

  return this.save();
};

// Instance method to get preferred routes
userProfileSchema.methods.getPreferredRoutes = function() {
  return this.frequentRoutes
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
};

module.exports = mongoose.model('UserProfile', userProfileSchema);