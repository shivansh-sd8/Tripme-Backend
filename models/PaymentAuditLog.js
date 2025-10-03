const mongoose = require('mongoose');

const paymentAuditLogSchema = new mongoose.Schema({
  // Reference to the payment
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true
  },
  
  // Reference to the booking
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  
  // User who initiated the payment
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Host of the booking
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Raw input parameters used for calculation
  inputParameters: {
    basePrice: Number,
    nights: Number,
    cleaningFee: Number,
    serviceFee: Number,
    securityDeposit: Number,
    extraGuestPrice: Number,
    extraGuests: Number,
    hourlyExtension: Number,
    discountAmount: Number,
    currency: String,
    platformFeeRate: Number
  },
  
  // Frontend calculation result
  frontendCalculation: {
    subtotal: Number,
    platformFee: Number,
    gst: Number,
    processingFee: Number,
    totalAmount: Number,
    hostEarning: Number,
    platformFeeRate: Number,
    calculatedAt: Date
  },
  
  // Backend calculation result
  backendCalculation: {
    subtotal: Number,
    platformFee: Number,
    gst: Number,
    processingFee: Number,
    totalAmount: Number,
    hostEarning: Number,
    platformFeeRate: Number,
    calculatedAt: Date
  },
  
  // Validation result
  validation: {
    isValid: Boolean,
    errors: [{
      field: String,
      frontend: Number,
      backend: Number,
      difference: Number
    }],
    tolerance: Number,
    validatedAt: Date
  },
  
  // Rate information
  rateInfo: {
    requestedRate: Number,        // Rate requested by frontend
    appliedRate: Number,          // Rate actually applied
    rateSource: String,           // 'database', 'cache', 'fallback'
    rateFetchedAt: Date,
    rateExpiredAt: Date
  },
  
  // Payment processing details
  paymentProcessing: {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'rejected'],
      default: 'pending'
    },
    rejectionReason: String,
    processedAt: Date,
    processingTimeMs: Number
  },
  
  // Security metadata
  security: {
    ipAddress: String,
    userAgent: String,
    sessionId: String,
    idempotencyKey: String,
    requestId: String
  },
  
  // Audit metadata
  audit: {
    action: {
      type: String,
      enum: ['payment_created', 'payment_processed', 'payment_rejected', 'rate_mismatch', 'validation_failed'],
      required: true
    },
    reason: String,
    adminNotes: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
paymentAuditLogSchema.index({ payment: 1 });
paymentAuditLogSchema.index({ booking: 1 });
paymentAuditLogSchema.index({ user: 1 });
paymentAuditLogSchema.index({ 'validation.isValid': 1 });
paymentAuditLogSchema.index({ 'audit.action': 1 });
paymentAuditLogSchema.index({ 'audit.severity': 1 });
paymentAuditLogSchema.index({ createdAt: -1 });

// Virtual for calculation difference
paymentAuditLogSchema.virtual('calculationDifference').get(function() {
  if (!this.frontendCalculation || !this.backendCalculation) return null;
  
  return {
    subtotal: Math.abs(this.frontendCalculation.subtotal - this.backendCalculation.subtotal),
    platformFee: Math.abs(this.frontendCalculation.platformFee - this.backendCalculation.platformFee),
    gst: Math.abs(this.frontendCalculation.gst - this.backendCalculation.gst),
    processingFee: Math.abs(this.frontendCalculation.processingFee - this.backendCalculation.processingFee),
    totalAmount: Math.abs(this.frontendCalculation.totalAmount - this.backendCalculation.totalAmount)
  };
});

// Static method to log payment calculation
paymentAuditLogSchema.statics.logPaymentCalculation = async function(data) {
  const {
    paymentId,
    bookingId,
    userId,
    hostId,
    inputParameters,
    frontendCalculation,
    backendCalculation,
    validation,
    rateInfo,
    security,
    audit
  } = data;
  
  const auditLog = new this({
    payment: paymentId,
    booking: bookingId,
    user: userId,
    host: hostId,
    inputParameters,
    frontendCalculation: {
      ...frontendCalculation,
      calculatedAt: new Date()
    },
    backendCalculation: {
      ...backendCalculation,
      calculatedAt: new Date()
    },
    validation: {
      ...validation,
      validatedAt: new Date()
    },
    rateInfo: {
      ...rateInfo,
      rateFetchedAt: new Date()
    },
    paymentProcessing: {
      status: 'pending',
      processedAt: null,
      processingTimeMs: 0
    },
    security,
    audit: {
      ...audit,
      action: validation.isValid ? 'payment_created' : 'validation_failed',
      severity: validation.isValid ? 'low' : 'high'
    }
  });
  
  await auditLog.save();
  return auditLog;
};

// Static method to update payment processing status
paymentAuditLogSchema.statics.updatePaymentStatus = async function(paymentId, status, additionalData = {}) {
  const auditLog = await this.findOne({ payment: paymentId }).sort({ createdAt: -1 });
  
  if (auditLog) {
    auditLog.paymentProcessing.status = status;
    auditLog.paymentProcessing.processedAt = new Date();
    
    if (additionalData.rejectionReason) {
      auditLog.paymentProcessing.rejectionReason = additionalData.rejectionReason;
    }
    
    if (additionalData.processingTimeMs) {
      auditLog.paymentProcessing.processingTimeMs = additionalData.processingTimeMs;
    }
    
    await auditLog.save();
  }
  
  return auditLog;
};

// Static method to get audit logs for a payment
paymentAuditLogSchema.statics.getPaymentAuditLogs = async function(paymentId) {
  return await this.find({ payment: paymentId })
    .populate('user', 'name email')
    .populate('host', 'name email')
    .sort({ createdAt: -1 });
};

// Static method to get validation failures
paymentAuditLogSchema.statics.getValidationFailures = async function(limit = 50) {
  return await this.find({ 'validation.isValid': false })
    .populate('user', 'name email')
    .populate('host', 'name email')
    .populate('payment', 'amount status')
    .populate('booking', 'receiptId status')
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('PaymentAuditLog', paymentAuditLogSchema);




