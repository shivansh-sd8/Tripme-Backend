const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
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
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Payment amount must be greater than 0']
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'wallet', 'upi', 'net_banking'],
    required: true
  },
  paymentDetails: {
    cardLast4: String,
    cardBrand: String,
    paymentGateway: String,
    transactionId: String,
    gatewayResponse: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded', 'cancelled'],
    default: 'pending'
  },
  
  // Fee breakdown
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal must be non-negative']
  },
  taxes: {
    type: Number,
    default: 0,
    min: [0, 'Taxes must be non-negative']
  },
  serviceFee: {
    type: Number,
    default: 0,
    min: [0, 'Service fee must be non-negative']
  },
  cleaningFee: {
    type: Number,
    default: 0,
    min: [0, 'Cleaning fee must be non-negative']
  },
  securityDeposit: {
    type: Number,
    default: 0,
    min: [0, 'Security deposit must be non-negative']
  },
  
  // Commission and payout structure
  commission: {
    platformFee: {
      type: Number,
      default: 0,
      min: [0, 'Platform fee must be non-negative']
    },
    hostEarning: {
      type: Number,
      default: 0,
      min: [0, 'Host earning must be non-negative']
    },
    processingFee: {
      type: Number,
      default: 0,
      min: [0, 'Processing fee must be non-negative']
    }
  },
  
  // Payout tracking
  payout: {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending'
    },
    scheduledDate: Date,
    processedDate: Date,
    amount: Number,
    method: {
      type: String,
      enum: ['bank_transfer', 'paypal', 'stripe_connect', 'manual'],
      default: 'bank_transfer'
    },
    reference: String,
    notes: String
  },
  
  // Refund tracking
  refunds: [{
    amount: {
      type: Number,
      required: true,
      min: [0, 'Refund amount must be non-negative']
    },
    reason: {
      type: String,
      enum: ['cancellation', 'host_cancel', 'dispute', 'overpayment', 'service_issue'],
      required: true
    },
    type: {
      type: String,
      enum: ['full', 'partial', 'service_fee_only'],
      required: true
    },
    processedAt: {
      type: Date,
      default: Date.now
    },
    transactionId: String,
    gatewayResponse: mongoose.Schema.Types.Mixed,
    adminNotes: String
  }],
  
  // Additional fields
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon'
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount amount must be non-negative']
  },
  currency: {
    type: String,
    default: 'INR',
    enum: ['INR', 'USD', 'EUR', 'GBP']
  },
  invoiceId: String,
  receiptUrl: String,
  
  // Metadata
  metadata: {
    ipAddress: String,
    userAgent: String,
    source: {
      type: String,
      enum: ['web', 'mobile_app', 'api'],
      default: 'web'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total refunded amount
paymentSchema.virtual('totalRefunded').get(function() {
  if (!this.refunds || this.refunds.length === 0) return 0;
  return this.refunds.reduce((sum, refund) => sum + refund.amount, 0);
});

// Virtual for net amount after refunds
paymentSchema.virtual('netAmount').get(function() {
  return this.amount - this.totalRefunded;
});

// Virtual for payout amount (host earning minus refunds)
paymentSchema.virtual('payoutAmount').get(function() {
  const refundedAmount = this.totalRefunded;
  const hostEarning = this.commission.hostEarning;
  
  // If refund is more than host earning, host gets nothing
  if (refundedAmount >= hostEarning) return 0;
  
  return hostEarning - refundedAmount;
});

// Pre-save hook to calculate totals
paymentSchema.pre('save', function(next) {
  // Ensure total amount equals subtotal + fees
  if (this.isModified('subtotal') || this.isModified('taxes') || this.isModified('serviceFee') || this.isModified('cleaningFee')) {
    this.amount = this.subtotal + this.taxes + this.serviceFee + this.cleaningFee;
  }
  
  // Calculate commission if not set
  if (!this.commission.platformFee && this.amount > 0) {
    const platformFeePercentage = 0.15; // 15% platform fee
    this.commission.platformFee = Math.round(this.amount * platformFeePercentage * 100) / 100;
    this.commission.hostEarning = Math.round((this.amount - this.commission.platformFee) * 100) / 100;
  }
  
  next();
});

// Indexes
paymentSchema.index({ booking: 1 });
paymentSchema.index({ user: 1 });
paymentSchema.index({ host: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ 'payout.status': 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ 'payout.scheduledDate': 1 });

module.exports = mongoose.model('Payment', paymentSchema);