const mongoose = require('mongoose');

const kycVerificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  identityDocument: {
    type: {
      type: String,
      enum: ['aadhar-card', 'pan-card', 'voter-id', 'passport', 'drivers-license'],
      required: true
    },
    number: {
      type: String,
      required: true
    },
    frontImage: {
      type: String,
      required: true
    },
    backImage: {
      type: String,
      required: true
    },
    expiryDate: {
      type: Date
    }
  },
  addressProof: {
    type: {
      type: String,
      enum: ['utility-bill', 'bank-statement', 'rental-agreement', 'property-tax', 'aadhar-address', 'voter-id-address'],
      required: true
    },
    documentImage: {
      type: String,
      required: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    }
  },
  selfie: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'expired'],
    default: 'pending'
  },
  rejectionReason: {
    type: String,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  verifiedAt: {
    type: Date
  },
  expiresAt: {
    type: Date
  },
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
kycVerificationSchema.index({ user: 1 }, { unique: true });
kycVerificationSchema.index({ status: 1 });
kycVerificationSchema.index({ verifiedBy: 1 });
kycVerificationSchema.index({ expiresAt: 1 });

// Pre-save hook to set expiry date
kycVerificationSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    // Set expiry to 1 year from now
    this.expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  }
  next();
});

// Methods
kycVerificationSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

kycVerificationSchema.methods.canBeVerified = function() {
  return this.status === 'pending' && !this.isExpired();
};

module.exports = mongoose.model('KycVerification', kycVerificationSchema); 