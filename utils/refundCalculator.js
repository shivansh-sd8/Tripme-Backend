/**
 * Refund Calculator Utility
 * Calculates refund amounts based on stored pricing breakdown
 */

const { calculatePricingBreakdown } = require('../config/pricing.config');

/**
 * Calculate refund breakdown based on refund type and stored pricing data
 * @param {Object} booking - Booking object with pricingBreakdown
 * @param {Object} payment - Payment object with pricingBreakdown
 * @param {String} refundType - Type of refund: 'full', 'partial', 'service_fee_only', 'cleaning_fee_only'
 * @param {Number} customAmount - Custom refund amount (for partial refunds)
 * @returns {Object} Refund breakdown
 */
function calculateRefundBreakdown(booking, payment, refundType, customAmount = 0) {
  const pricingBreakdown = booking.pricingBreakdown || payment.pricingBreakdown;
  
  if (!pricingBreakdown) {
    throw new Error('Pricing breakdown not found in booking or payment');
  }

  const customerBreakdown = pricingBreakdown.customerBreakdown;
  const hostBreakdown = pricingBreakdown.hostBreakdown;
  const platformBreakdown = pricingBreakdown.platformBreakdown;

  let refundBreakdown = {
    baseAmount: 0,
    extraGuestCost: 0,
    cleaningFee: 0,
    serviceFee: 0,
    securityDeposit: 0,
    hourlyExtension: 0,
    discountAmount: 0,
    subtotal: 0,
    platformFee: 0,
    processingFee: 0,
    gst: 0,
    totalAmount: 0,
    hostEarning: 0,
    platformRevenue: 0
  };

  switch (refundType) {
    case 'full':
      // Refund everything
      refundBreakdown = {
        baseAmount: customerBreakdown.baseAmount,
        extraGuestCost: customerBreakdown.extraGuestCost || 0,
        cleaningFee: customerBreakdown.cleaningFee,
        serviceFee: customerBreakdown.serviceFee,
        securityDeposit: customerBreakdown.securityDeposit,
        hourlyExtension: customerBreakdown.hourlyExtension || 0,
        discountAmount: customerBreakdown.discountAmount || 0,
        subtotal: customerBreakdown.subtotal,
        platformFee: customerBreakdown.platformFee,
        processingFee: customerBreakdown.processingFee,
        gst: customerBreakdown.gst,
        totalAmount: customerBreakdown.totalAmount,
        hostEarning: hostBreakdown.hostEarning,
        platformRevenue: platformBreakdown.platformRevenue
      };
      break;

    case 'partial':
      // Refund custom amount proportionally
      const totalOriginal = customerBreakdown.totalAmount;
      const refundRatio = customAmount / totalOriginal;
      
      refundBreakdown = {
        baseAmount: Math.round(customerBreakdown.baseAmount * refundRatio * 100) / 100,
        extraGuestCost: Math.round((customerBreakdown.extraGuestCost || 0) * refundRatio * 100) / 100,
        cleaningFee: Math.round(customerBreakdown.cleaningFee * refundRatio * 100) / 100,
        serviceFee: Math.round(customerBreakdown.serviceFee * refundRatio * 100) / 100,
        securityDeposit: Math.round(customerBreakdown.securityDeposit * refundRatio * 100) / 100,
        hourlyExtension: Math.round((customerBreakdown.hourlyExtension || 0) * refundRatio * 100) / 100,
        discountAmount: Math.round((customerBreakdown.discountAmount || 0) * refundRatio * 100) / 100,
        subtotal: Math.round(customerBreakdown.subtotal * refundRatio * 100) / 100,
        platformFee: Math.round(customerBreakdown.platformFee * refundRatio * 100) / 100,
        processingFee: Math.round(customerBreakdown.processingFee * refundRatio * 100) / 100,
        gst: Math.round(customerBreakdown.gst * refundRatio * 100) / 100,
        totalAmount: customAmount,
        hostEarning: Math.round(hostBreakdown.hostEarning * refundRatio * 100) / 100,
        platformRevenue: Math.round(platformBreakdown.platformRevenue * refundRatio * 100) / 100
      };
      break;

    case 'service_fee_only':
      // Refund only service fee
      refundBreakdown = {
        baseAmount: 0,
        extraGuestCost: 0,
        cleaningFee: 0,
        serviceFee: customerBreakdown.serviceFee,
        securityDeposit: 0,
        hourlyExtension: 0,
        discountAmount: 0,
        subtotal: customerBreakdown.serviceFee,
        platformFee: 0,
        processingFee: 0,
        gst: 0,
        totalAmount: customerBreakdown.serviceFee,
        hostEarning: 0,
        platformRevenue: 0
      };
      break;

    case 'cleaning_fee_only':
      // Refund only cleaning fee
      refundBreakdown = {
        baseAmount: 0,
        extraGuestCost: 0,
        cleaningFee: customerBreakdown.cleaningFee,
        serviceFee: 0,
        securityDeposit: 0,
        hourlyExtension: 0,
        discountAmount: 0,
        subtotal: customerBreakdown.cleaningFee,
        platformFee: 0,
        processingFee: 0,
        gst: 0,
        totalAmount: customerBreakdown.cleaningFee,
        hostEarning: 0,
        platformRevenue: 0
      };
      break;

    default:
      throw new Error(`Invalid refund type: ${refundType}`);
  }

  return refundBreakdown;
}

/**
 * Calculate refund amounts for different stakeholders
 * @param {Object} refundBreakdown - Refund breakdown object
 * @returns {Object} Refund amounts for customer, host, and platform
 */
function calculateRefundAmounts(refundBreakdown) {
  return {
    customerRefund: refundBreakdown.totalAmount,
    hostDeduction: refundBreakdown.hostEarning,
    platformDeduction: refundBreakdown.platformRevenue,
    netRefund: refundBreakdown.totalAmount
  };
}

/**
 * Validate refund request against booking status and timing
 * @param {Object} booking - Booking object
 * @param {String} refundType - Type of refund requested
 * @param {Number} customAmount - Custom refund amount
 * @returns {Object} Validation result
 */
function validateRefundRequest(booking, refundType, customAmount = 0) {
  const errors = [];
  const warnings = [];

  // Check booking status
  if (booking.status === 'cancelled') {
    errors.push('Booking is already cancelled');
  }

  if (booking.status === 'completed') {
    errors.push('Cannot refund completed booking');
  }

  // Check payment status
  if (booking.paymentStatus !== 'paid') {
    errors.push('Booking payment not completed');
  }

  // Check if already refunded
  if (booking.refunded) {
    errors.push('Booking already has refund processed');
  }

  // Validate custom amount for partial refunds
  if (refundType === 'partial') {
    if (customAmount <= 0) {
      errors.push('Custom refund amount must be greater than 0');
    }
    if (customAmount > booking.totalAmount) {
      errors.push('Refund amount cannot exceed total booking amount');
    }
  }

  // Check timing for full refunds
  if (refundType === 'full') {
    const now = new Date();
    const checkInDate = new Date(booking.checkIn);
    const hoursUntilCheckIn = (checkInDate - now) / (1000 * 60 * 60);

    if (hoursUntilCheckIn < 24) {
      warnings.push('Full refund requested within 24 hours of check-in');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  calculateRefundBreakdown,
  calculateRefundAmounts,
  validateRefundRequest
};
