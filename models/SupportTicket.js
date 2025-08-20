const mongoose = require('mongoose');
const { Schema } = mongoose;

const ticketSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  category: {
    type: String,
    enum: ['booking', 'payment', 'account', 'property', 'other']
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  priority: { type: Number, min: 1, max: 5, default: 3 },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'Admin' },
  responses: [{
    user: { type: Schema.Types.ObjectId, refPath: 'responses.userType' },
    userType: { type: String, enum: ['User', 'Admin'] },
    message: String,
    attachments: [String],
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Indexes
ticketSchema.index({ user: 1, status: 1 });
ticketSchema.index({ status: 1, priority: -1 });

module.exports = mongoose.model('SupportTicket', ticketSchema);