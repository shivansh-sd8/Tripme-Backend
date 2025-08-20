const mongoose = require('mongoose');
const { Schema } = mongoose;

const sessionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true },
  ipAddress: { type: String, required: true },
  userAgent: { type: String, required: true },
  device: {
    type: { type: String, enum: ['mobile', 'tablet', 'desktop', 'other'] },
    name: String
  },
  os: String,
  browser: String,
  lastActivity: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

// TTL index for auto-expiry
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ user: 1, token: 1 });

module.exports = mongoose.model('Session', sessionSchema);