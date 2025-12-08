const mongoose = require('mongoose');
const { Schema } = mongoose;

const availabilityEventSchema = new Schema({
  property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },

  time: {
    type: Date,
    required: true,
    index: true
  },

  eventType: {
    type: String,
    enum: [
      'booking_start',
      'booking_end',
      'maintenance_start',
      'maintenance_end',
      'block_start',
      'block_end'
    ],
    required: true,
    index: true
  },

  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },

  meta: Schema.Types.Mixed
}, { timestamps: true });

availabilityEventSchema.index({ property: 1, time: 1 });

module.exports = mongoose.model('AvailabilityEvent', availabilityEventSchema);
