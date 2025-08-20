const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  bookingType: {
    type: String,
    enum: ['property', 'service'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'confirmed', 'cancelled', 'completed', 'expired'],
    default: 'pending'
  },
  checkIn: {
    type: Date
  },
  checkOut: {
    type: Date
  },
  checkInTime: {
    type: String,
    default: '11:00'
  },
  checkOutTime: {
    type: String,
    default: '10:00'
  },
  timeSlot: {
    startTime: Date,
    endTime: Date
  },
  guests: {
    adults: {
      type: Number,
      default: 1
    },
    children: {
      type: Number,
      default: 0
    },
    infants: {
      type: Number,
      default: 0
    }
  },
  totalAmount: {
    type: Number,
    required: true
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  serviceFee: {
    type: Number,
    default: 0
  },
  cleaningFee: {
    type: Number,
    default: 0
  },
  securityDeposit: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  cancellationPolicy: {
    type: String,
    enum: ['flexible', 'moderate', 'strict', 'super-strict', 'non-refundable']
  },
  specialRequests: {
    type: String,
    maxlength: [500, 'Special requests cannot exceed 500 characters']
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'partially_refunded', 'failed'],
    default: 'pending'
  },
  paymentIntentId: String,
  refundAmount: {
    type: Number,
    default: 0
  },
  refunded: {
    type: Boolean,
    default: false
  },
  // Cancellation fields
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  cancellationReason: {
    type: String,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  },
  refundStatus: {
    type: String,
    enum: ['pending', 'processed', 'completed', 'not_applicable'],
    default: 'not_applicable'
  },
  receiptId: {
    type: String,
    unique: true
  },
  // Check-in status
  checkedIn: {
    type: Boolean,
    default: false
  },
  checkedInAt: {
    type: Date
  },
  checkedInBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  checkInNotes: {
    type: String,
    maxlength: [500, 'Check-in notes cannot exceed 500 characters']
  },
  couponApplied: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon'
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  hostFee: {
    type: Number,
    default: 0
  },
  platformFee: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Custom validator to ensure either listing or service is provided, but not both
bookingSchema.pre('save', function(next) {
  if (!this.listing && !this.service) {
    return next(new Error('Either listing or service must be provided'));
  }
  if (this.listing && this.service) {
    return next(new Error('Cannot have both listing and service in the same booking'));
  }
  next();
});

// Indexes
bookingSchema.index({ user: 1 });
bookingSchema.index({ host: 1 });
bookingSchema.index({ listing: 1 });
bookingSchema.index({ service: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ checkIn: 1 });
bookingSchema.index({ checkOut: 1 });
bookingSchema.index({ receiptId: 1 });

// Virtuals
bookingSchema.virtual('review', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'booking',
  justOne: true
});

bookingSchema.virtual('payment', {
  ref: 'Payment',
  localField: '_id',
  foreignField: 'booking',
  justOne: true
});

// Pre-save hook to generate receipt ID
bookingSchema.pre('save', function(next) {
  if (!this.receiptId) {
    this.receiptId = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);