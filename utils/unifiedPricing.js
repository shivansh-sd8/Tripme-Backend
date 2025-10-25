/**
 * UNIFIED PRICING SYSTEM
 * Single source of truth for all pricing calculations
 * This replaces all scattered pricing logic across the codebase
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
 * UNIFIED PRICING CALCULATION
 * This is the ONLY function that should calculate pricing
 * All other pricing functions should be deprecated
 * 
 * @param {Object} params - Pricing parameters
 * @returns {Promise<Object>} Complete pricing breakdown
 */
async function calculateUnifiedPricing(params) {
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
    currency = 'INR',
    bookingType = 'daily',
    // 24-hour booking parameters
    basePrice24Hour,
    totalHours,
    extensionHours = 0
  } = params;

  // Get current platform fee rate from database
  const platformFeeRate = await getCurrentPlatformFeeRate();

  // Calculate base amount based on booking type
  let baseAmount;
  if (bookingType === '24hour' || basePrice24Hour) {
    // 24-hour booking
    baseAmount = basePrice24Hour || basePrice;
    
    // Add extension cost if applicable
    if (extensionHours > 0) {
      const extensionCost = calculateHourlyExtensionCost(basePrice24Hour || basePrice, extensionHours);
      baseAmount += extensionCost;
    }
  } else {
    // Daily booking
    baseAmount = basePrice * nights;
  }

  // Add extra guest charges
  if (extraGuests > 0) {
    const guestMultiplier = bookingType === '24hour' ? 1 : nights;
    baseAmount += extraGuestPrice * extraGuests * guestMultiplier;
  }

  // Add host-set fees (excluding security deposit - it's held separately)
  const hostFees = cleaningFee + serviceFee;
  
  // Add hourly extension cost
  const extensionCost = hourlyExtension || 0;
  
  // Calculate subtotal for host earning (excluding security deposit)
  const hostSubtotal = baseAmount + hostFees + extensionCost - discountAmount;
  
  // Calculate total subtotal (including security deposit for customer payment)
  const totalSubtotal = hostSubtotal + securityDeposit;
  
  // Calculate TripMe service fee (on host subtotal only, not security deposit)
  const platformFee = toTwoDecimals(hostSubtotal * platformFeeRate);
  
  // Calculate GST (18% of total subtotal including security deposit)
  const gst = toTwoDecimals(totalSubtotal * 0.18);
  
  // Calculate processing fee (2.9% + ₹30 fixed on total subtotal)
  const processingFee = toTwoDecimals(totalSubtotal * 0.029 + 30);
  
  // Calculate total amount (what customer pays)
  const totalAmount = toTwoDecimals(totalSubtotal + platformFee + gst + processingFee);
  
  // Calculate host earning (host subtotal minus TripMe service fee - security deposit is held separately)
  const hostEarning = toTwoDecimals(hostSubtotal - platformFee);
  
  // Calculate platform revenue (TripMe service fee + processing fee)
  const platformRevenue = toTwoDecimals(platformFee + processingFee);

  return {
    // Base pricing
    basePrice: toTwoDecimals(basePrice),
    baseAmount: toTwoDecimals(baseAmount),
    nights: bookingType === '24hour' ? 1 : nights,
    totalHours: totalHours || (bookingType === '24hour' ? 24 + extensionHours : undefined),
    extraGuests,
    extraGuestCost: toTwoDecimals(extraGuestPrice * extraGuests * (bookingType === '24hour' ? 1 : nights)),
    
    // Host-set fees
    cleaningFee: toTwoDecimals(cleaningFee),
    serviceFee: toTwoDecimals(serviceFee),
    securityDeposit: toTwoDecimals(securityDeposit),
    hostFees: toTwoDecimals(hostFees),
    
    // Extensions and discounts
    hourlyExtension: toTwoDecimals(extensionCost),
    discountAmount: toTwoDecimals(discountAmount),
    
    // Subtotal (before platform fee and taxes)
    subtotal: toTwoDecimals(totalSubtotal),
    hostSubtotal: toTwoDecimals(hostSubtotal),
    
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
        subtotal: toTwoDecimals(totalSubtotal),
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
        subtotal: toTwoDecimals(hostSubtotal),
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
function calculateHourlyExtensionCost(basePrice, hours) {
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

/**
 * Calculate total hours including extensions
 * @param {number} baseHours - Base hours (default: 24)
 * @param {number} extensionHours - Extension hours (6, 12, or 18)
 * @returns {number} Total hours
 */
function calculateTotalHours(baseHours = 24, extensionHours = 0) {
  return baseHours + extensionHours;
}

/**
 * Calculate checkout time based on check-in and total hours
 * @param {Date} checkInDateTime - Check-in date and time
 * @param {number} totalHours - Total booking hours
 * @returns {Date} Checkout date and time
 */
function calculateCheckoutTime(checkInDateTime, totalHours) {
  const checkoutTime = new Date(checkInDateTime);
  checkoutTime.setHours(checkoutTime.getHours() + totalHours);
  return checkoutTime;
}

/**
 * Calculate next available time (checkout + buffer time)
 * @param {Date} checkOutDateTime - Checkout date and time
 * @param {number} bufferHours - Buffer hours for property preparation
 * @returns {Date} Next available time
 */
function calculateNextAvailableTime(checkOutDateTime, bufferHours = 2) {
  const nextAvailable = new Date(checkOutDateTime);
  nextAvailable.setHours(nextAvailable.getHours() + bufferHours);
  return nextAvailable;
}

/**
 * Validate 24-hour booking parameters
 * @param {Object} params - Booking parameters
 * @returns {Object} Validation result
 */
function validate24HourBooking(params) {
  const errors = [];
  const { checkInDateTime, totalHours, minHours = 24, maxHours = 168 } = params;
  
  if (!checkInDateTime) {
    errors.push('Check-in date and time is required');
  } else {
    const checkIn = new Date(checkInDateTime);
    const now = new Date();
    
    if (checkIn < now) {
      errors.push('Check-in time cannot be in the past');
    }
  }
  
  if (totalHours < minHours) {
    errors.push(`Minimum booking duration is ${minHours} hours`);
  }
  
  if (totalHours > maxHours) {
    errors.push(`Maximum booking duration is ${maxHours} hours`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  // Main pricing function - USE THIS FOR ALL PRICING CALCULATIONS
  calculateUnifiedPricing,
  
  // Utility functions
  toTwoDecimals,
  getCurrentPlatformFeeRate,
  calculateHourlyExtensionCost,
  calculateTotalHours,
  calculateCheckoutTime,
  calculateNextAvailableTime,
  validate24HourBooking,
  validatePricingConsistency
};
