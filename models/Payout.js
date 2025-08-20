const mongoose = require('mongoose');
const { Schema } = mongoose;

const payoutSchema = new Schema({
  host: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  payment: {
    type: Schema.Types.ObjectId,
    ref: 'Payment',
    required: true
  },
  booking: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Payout amount must be non-negative']
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR', 'GBP']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed'],
    default: 'pending'
  },
  method: {
    type: String,
    enum: ['bank_transfer', 'paypal', 'stripe_connect', 'manual', 'wallet'],
    required: true
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  processedDate: Date,
  reference: String,
  transactionId: String,
  gatewayResponse: Schema.Types.Mixed,
  
  // Bank details (if applicable)
  bankDetails: {
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String,
    bankName: String
  },
  
  // PayPal details (if applicable)
  paypalDetails: {
    paypalEmail: String,
    paypalId: String
  },
  
  // Stripe Connect details (if applicable)
  stripeDetails: {
    stripeAccountId: String,
    transferId: String
  },
  
  // Manual payout details
  manualPayout: {
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin'
    },
    processedAt: Date,
    notes: String,
    receipt: String
  },
  
  // Fee breakdown
  fees: {
    processingFee: {
      type: Number,
      default: 0
    },
    taxDeduction: {
      type: Number,
      default: 0
    },
    netAmount: {
      type: Number,
      required: true
    }
  },
  
  // Metadata
  notes: String,
  adminNotes: String,
  tags: [String],
  
  // Reversal details (if applicable)
  reversal: {
    reason: String,
    reversedAt: Date,
    reversedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin'
    },
    notes: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for payout status display
payoutSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    'pending': 'Pending',
    'processing': 'Processing',
    'completed': 'Completed',
    'failed': 'Failed',
    'cancelled': 'Cancelled',
    'reversed': 'Reversed'
  };
  return statusMap[this.status] || this.status;
});

// Virtual for payout method display
payoutSchema.virtual('methodDisplay').get(function() {
  const methodMap = {
    'bank_transfer': 'Bank Transfer',
    'paypal': 'PayPal',
    'stripe_connect': 'Stripe Connect',
    'manual': 'Manual Payout',
    'wallet': 'Wallet Credit'
  };
  return methodMap[this.method] || this.method;
});

// Pre-save hook to calculate net amount
payoutSchema.pre('save', function(next) {
  if (this.isModified('fees.processingFee') || this.isModified('fees.taxDeduction')) {
    this.fees.netAmount = this.amount - this.fees.processingFee - this.fees.taxDeduction;
  }
  next();
});

// Indexes
payoutSchema.index({ host: 1 });
payoutSchema.index({ payment: 1 });
payoutSchema.index({ booking: 1 });
payoutSchema.index({ status: 1 });
payoutSchema.index({ scheduledDate: 1 });
payoutSchema.index({ processedDate: 1 });
payoutSchema.index({ createdAt: -1 });
payoutSchema.index({ reference: 1 });
payoutSchema.index({ transactionId: 1 });

module.exports = mongoose.model('Payout', payoutSchema);
