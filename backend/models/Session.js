const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional, for logged-in users
  history: [{
    role: String,
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  context: {
    fromCity: Object,
    toCity: Object,
    date: Date,
    lastSearchResults: [mongoose.Schema.Types.Mixed],
    selectedFlight: mongoose.Schema.Types.Mixed
  },
  bookingDraft: mongoose.Schema.Types.Mixed,
  expiresAt: { type: Date, default: Date.now, expires: 86400 } // 24 hours
}, { timestamps: true });

// Index for efficient queries
sessionSchema.index({ sessionId: 1 });
sessionSchema.index({ userId: 1 });
sessionSchema.index({ expiresAt: 1 });

// Static method to clean up expired sessions
sessionSchema.statics.cleanupExpired = async function() {
  const now = new Date();
  return await this.deleteMany({ expiresAt: { $lt: now } });
};

// Instance method to check if session is expired
sessionSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Instance method to extend session
sessionSchema.methods.extendSession = function(hours = 24) {
  this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  return this.save();
};

module.exports = mongoose.model('Session', sessionSchema);