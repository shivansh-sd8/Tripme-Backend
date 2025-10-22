const mongoose = require('mongoose');
const { Schema } = mongoose;

const availabilitySchema = new Schema({
  property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
  // NEW: Time-based availability fields
  startDateTime: {
    type: Date,
    required: function() { return this.bookingType === '24hour'; }
  },
  endDateTime: {
    type: Date,
    required: function() { return this.bookingType === '24hour'; }
  },
  duration: {
    type: Number, // Duration in hours
    required: function() { return this.bookingType === '24hour'; }
  },
  bookingType: {
    type: String,
    enum: ['daily', '24hour'],
    default: 'daily'
  },
  // EXISTING: Keep for backward compatibility
  date: { 
    type: Date, 
    required: function() { return this.bookingType === 'daily'; },
    validate: {
      validator: function(v) {
        return !v || v >= new Date();
      },
      message: 'Availability date cannot be in the past'
    }
  },
  status: {
    type: String,
    enum: ['available', 'blocked', 'booked', 'maintenance'],
    default: 'available'
  },
  reason: String,
  bookedBy: { type: Schema.Types.ObjectId, ref: 'Booking' },
  bookedAt: { type: Date },
  blockedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  blockedAt: { type: Date }
}, { timestamps: true });

// Compound index for fast date range queries
availabilitySchema.index({ property: 1, date: 1 }, { unique: true });
availabilitySchema.index({ date: 1, status: 1 });

// NEW: Indexes for 24-hour time-based availability
availabilitySchema.index({ property: 1, startDateTime: 1, endDateTime: 1 });
availabilitySchema.index({ startDateTime: 1, endDateTime: 1, status: 1 });
availabilitySchema.index({ property: 1, bookingType: 1, status: 1 });

module.exports = mongoose.model('Availability', availabilitySchema);