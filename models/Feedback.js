const mongoose = require('mongoose');
const { Schema } = mongoose;

const feedbackSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  type: {
    type: String,
    enum: ['bug', 'suggestion', 'compliment', 'general']
  },
  message: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5 },
  pageUrl: String,
  metadata: {
    browser: String,
    os: String,
    device: String
  },
  status: {
    type: String,
    enum: ['new', 'reviewed', 'planned', 'completed', 'rejected'],
    default: 'new'
  },
  adminNotes: String
}, { timestamps: true });

// Indexes
feedbackSchema.index({ type: 1, status: 1 });
feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);