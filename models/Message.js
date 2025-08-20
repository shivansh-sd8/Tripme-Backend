const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'link'],
    default: 'text'
  },
  mediaUrl: String,
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  isVisiblePreBooking: {
    type: Boolean,
    default: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  }
}, {
  timestamps: true
});

// Indexes
messageSchema.index({ sender: 1 });
messageSchema.index({ receiver: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ listing: 1 });
messageSchema.index({ service: 1 });
messageSchema.index({ booking: 1 });

module.exports = mongoose.model('Message', messageSchema);