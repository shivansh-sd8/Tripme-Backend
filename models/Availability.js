const mongoose = require('mongoose');
const { Schema } = mongoose;

const availabilitySchema = new Schema({
  property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
  date: { 
    type: Date, 
    required: true,
    validate: {
      validator: function(v) {
        return v >= new Date();
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

module.exports = mongoose.model('Availability', availabilitySchema);