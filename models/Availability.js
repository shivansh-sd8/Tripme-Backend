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
    enum: ['available', 'blocked', 'booked', 'maintenance', 'unavailable', 'partially-available', 'on-hold'],
    default: 'available'
  },
  // NEW: Hour-based availability ranges
  // If availableHours is empty/null → entire day is available
  // If availableHours has entries → only those time ranges are available
  availableHours: [{
    startTime: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v); // HH:MM format
        },
        message: 'startTime must be in HH:MM format (00:00-23:59)'
      }
    },
    endTime: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v); // HH:MM format
        },
        message: 'endTime must be in HH:MM format (00:00-23:59)'
      }
    }
  }],
  // NEW: Hour-based unavailability ranges
  // If unavailableHours has entries → those time ranges are blocked even if the day is available
  // Works in combination with availableHours: unavailableHours take precedence
  unavailableHours: [{
    startTime: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v); // HH:MM format
        },
        message: 'startTime must be in HH:MM format (00:00-23:59)'
      }
    },
    endTime: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v); // HH:MM format
        },
        message: 'endTime must be in HH:MM format (00:00-23:59)'
      }
    }
  }],
  // NEW: Hour-based on-hold ranges
  // If onHoldHours has entries → those time ranges are on hold (temporarily unavailable)
  // If onHoldHours is empty and status is 'on-hold' → entire day is on hold
  onHoldHours: [{
    startTime: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v); // HH:MM format
        },
        message: 'startTime must be in HH:MM format (00:00-23:59)'
      }
    },
    endTime: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v); // HH:MM format
        },
        message: 'endTime must be in HH:MM format (00:00-23:59)'
      }
    }
  }],
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

// Validate that endTime > startTime for each hour range
availabilitySchema.pre('save', function(next) {
  // Validate availableHours
  if (this.availableHours && this.availableHours.length > 0) {
    for (const range of this.availableHours) {
      const [startH, startM] = range.startTime.split(':').map(Number);
      const [endH, endM] = range.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      
      if (endMinutes <= startMinutes) {
        return next(new Error('availableHours: endTime must be after startTime'));
      }
    }
  }
  
  // Validate unavailableHours
  if (this.unavailableHours && this.unavailableHours.length > 0) {
    for (const range of this.unavailableHours) {
      const [startH, startM] = range.startTime.split(':').map(Number);
      const [endH, endM] = range.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      
      if (endMinutes <= startMinutes) {
        return next(new Error('unavailableHours: endTime must be after startTime'));
      }
    }
  }
  
  // Validate onHoldHours
  if (this.onHoldHours && this.onHoldHours.length > 0) {
    for (const range of this.onHoldHours) {
      const [startH, startM] = range.startTime.split(':').map(Number);
      const [endH, endM] = range.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      
      if (endMinutes <= startMinutes) {
        return next(new Error('onHoldHours: endTime must be after startTime'));
      }
    }
  }
  
  next();
});

module.exports = mongoose.model('Availability', availabilitySchema);