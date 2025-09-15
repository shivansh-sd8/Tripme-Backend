/**
 * Shared Pricing Utilities
 * Centralized pricing calculations and utilities for backend
 */

const PricingConfig = require('../models/PricingConfig');

/**
 * Round to two decimal places consistently
 * @param {number} value - Value to round
 * @returns {number} Rounded value
 */
function toTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Get current platform fee rate from database
 * @returns {Promise<number>} Current platform fee rate
 */
async function getCurrentPlatformFeeRate() {
  try {
    const rate = await PricingConfig.getCurrentPlatformFeeRate();
    return rate;
  } catch (error) {
    console.error('❌ Error fetching platform fee rate:', error);
    console.warn('⚠️ Using fallback platform fee rate: 15%');
    return 0.15; // Fallback with warning
  }
}

/**
 * Calculate pricing breakdown with dynamic platform fee rate
 * @param {Object} params - Pricing parameters
 * @returns {Promise<Object>} Complete pricing breakdown
 */
async function calculatePricingBreakdown(params) {
  const {
    basePrice,
    nights = 1,
    cleaningFee = 0,
    serviceFee = 0,
    securityDeposit = 0,
    extraGuestPrice = 0,
    extraGuests = 0,
    hourlyExtension = 0,
    discountAmount = 0,
    currency = 'INR'
  } = params;

  // Get current platform fee rate from database
  const platformFeeRate = await getCurrentPlatformFeeRate();

  // Calculate base amount
  let baseAmount = basePrice * nights;
  
  // Add extra guest charges
  if (extraGuests > 0) {
    baseAmount += extraGuestPrice * extraGuests * nights;
  }
  
  // Add host-set fees
  const hostFees = cleaningFee + serviceFee + securityDeposit;
  
  // Add hourly extension
  const extensionCost = hourlyExtension || 0;
  
  // Calculate subtotal (before platform fee and taxes)
  const subtotal = baseAmount + hostFees + extensionCost - discountAmount;
  
  // Calculate TripMe service fee (dynamic rate of subtotal)
  const platformFee = toTwoDecimals(subtotal * platformFeeRate);
  
  // Calculate GST (18% of subtotal)
  const gst = toTwoDecimals(subtotal * 0.18);
  
  // Calculate processing fee (2.9% + ₹30 fixed)
  const processingFee = toTwoDecimals(subtotal * 0.029 + 30);
  
  // Calculate total amount (what customer pays)
  const totalAmount = toTwoDecimals(subtotal + platformFee + gst + processingFee);
  
  // Calculate host earning (subtotal minus TripMe service fee)
  const hostEarning = toTwoDecimals(subtotal - platformFee);
  
  // Calculate platform revenue (TripMe service fee + processing fee)
  const platformRevenue = toTwoDecimals(platformFee + processingFee);

  return {
    // Base pricing
    baseAmount: toTwoDecimals(baseAmount),
    nights,
    extraGuests,
    extraGuestCost: toTwoDecimals(extraGuestPrice * extraGuests * nights),
    
    // Host-set fees
    cleaningFee: toTwoDecimals(cleaningFee),
    serviceFee: toTwoDecimals(serviceFee),
    securityDeposit: toTwoDecimals(securityDeposit),
    hostFees: toTwoDecimals(hostFees),
    
    // Extensions and discounts
    hourlyExtension: toTwoDecimals(extensionCost),
    discountAmount: toTwoDecimals(discountAmount),
    
    // Subtotal (before platform fee and taxes)
    subtotal: toTwoDecimals(subtotal),
    
    // TripMe service fees
    platformFee: toTwoDecimals(platformFee),
    processingFee: toTwoDecimals(processingFee),
    platformRevenue: toTwoDecimals(platformRevenue),
    
    // Taxes
    gst: toTwoDecimals(gst),
    
    // Final amounts
    totalAmount: toTwoDecimals(totalAmount),
    hostEarning: toTwoDecimals(hostEarning),
    
    // Currency
    currency,
    
    // Rate used for calculation
    platformFeeRate: platformFeeRate,
    
    // Breakdown for display
    breakdown: {
      // What customer sees
      customerBreakdown: {
        baseAmount: toTwoDecimals(baseAmount),
        cleaningFee: toTwoDecimals(cleaningFee),
        serviceFee: toTwoDecimals(serviceFee),
        securityDeposit: toTwoDecimals(securityDeposit),
        hourlyExtension: toTwoDecimals(extensionCost),
        discountAmount: toTwoDecimals(discountAmount),
        subtotal: toTwoDecimals(subtotal),
        platformFee: toTwoDecimals(platformFee),
        gst: toTwoDecimals(gst),
        processingFee: toTwoDecimals(processingFee),
        totalAmount: toTwoDecimals(totalAmount)
      },
      
      // What host sees
      hostBreakdown: {
        baseAmount: toTwoDecimals(baseAmount),
        cleaningFee: toTwoDecimals(cleaningFee),
        serviceFee: toTwoDecimals(serviceFee),
        securityDeposit: toTwoDecimals(securityDeposit),
        hourlyExtension: toTwoDecimals(extensionCost),
        discountAmount: toTwoDecimals(discountAmount),
        subtotal: toTwoDecimals(subtotal),
        platformFee: toTwoDecimals(platformFee),
        hostEarning: toTwoDecimals(hostEarning)
      },
      
      // What TripMe sees
      platformBreakdown: {
        platformFee: toTwoDecimals(platformFee),
        processingFee: toTwoDecimals(processingFee),
        gst: toTwoDecimals(gst),
        platformRevenue: toTwoDecimals(platformRevenue)
      }
    }
  };
}

/**
 * Calculate hourly extension cost using shared rates
 * @param {number} basePrice - Daily base price
 * @param {number} hours - Extension hours (6, 12, or 18)
 * @returns {number} Extension cost
 */
function calculateHourlyExtension(basePrice, hours) {
  const HOURLY_RATES = {
    6: 0.30,   // 30% of daily rate
    12: 0.60,  // 60% of daily rate
    18: 0.75   // 75% of daily rate
  };
  
  const rate = HOURLY_RATES[hours] || 0;
  return toTwoDecimals(basePrice * rate);
}

/**
 * Validate pricing calculation consistency
 * @param {Object} frontendPricing - Frontend calculation result
 * @param {Object} backendPricing - Backend calculation result
 * @returns {Object} Validation result
 */
function validatePricingConsistency(frontendPricing, backendPricing) {
  const errors = [];
  const tolerance = 0.01; // 1 paisa tolerance
  
  // Check key values
  const checks = [
    { name: 'subtotal', frontend: frontendPricing.subtotal, backend: backendPricing.subtotal },
    { name: 'platformFee', frontend: frontendPricing.platformFee, backend: backendPricing.platformFee },
    { name: 'gst', frontend: frontendPricing.gst, backend: backendPricing.gst },
    { name: 'processingFee', frontend: frontendPricing.processingFee, backend: backendPricing.processingFee },
    { name: 'totalAmount', frontend: frontendPricing.totalAmount, backend: backendPricing.totalAmount }
  ];
  
  for (const check of checks) {
    const difference = Math.abs(check.frontend - check.backend);
    if (difference > tolerance) {
      errors.push({
        field: check.name,
        frontend: check.frontend,
        backend: check.backend,
        difference: difference
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    tolerance
  };
}

module.exports = {
  toTwoDecimals,
  getCurrentPlatformFeeRate,
  calculatePricingBreakdown,
  calculateHourlyExtension,
  validatePricingConsistency
};
