const mongoose = require('mongoose');
const { Schema } = mongoose;

const verificationTokenSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true },
  type: {
    type: String,
    enum: ['email', 'phone', 'reset_password', 'password_reset','2fa'],
    required: true
  },
  expiresAt: { type: Date, required: true },
  usedAt: Date,
  metadata: Schema.Types.Mixed
}, { timestamps: true });

// TTL index for auto-cleanup
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
verificationTokenSchema.index({ user: 1, type: 1 });

module.exports = mongoose.model('VerificationToken', verificationTokenSchema);