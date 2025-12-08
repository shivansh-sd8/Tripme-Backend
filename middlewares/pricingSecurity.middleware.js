/**
 * Pricing Security Middleware
 * Comprehensive security measures for pricing calculations
 */

const crypto = require('crypto');
const { paymentRateLimit } = require('../utils/paymentSecurity');

/**
 * Rate limiting for pricing calculations
 */
const pricingRateLimit = {
  attempts: new Map(),
  maxAttempts: 20, // Max pricing calculations per 5 minutes
  windowMs: 5 * 60 * 1000, // 5 minutes
  
  isAllowed(clientId) {
    const now = Date.now();
    const clientAttempts = this.attempts.get(clientId) || [];
    
    // Remove old attempts outside the window
    const validAttempts = clientAttempts.filter(time => now - time < this.windowMs);
    
    if (validAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    // Add current attempt
    validAttempts.push(now);
    this.attempts.set(clientId, validAttempts);
    
    return true;
  },
  
  getRemainingAttempts(clientId) {
    const now = Date.now();
    const clientAttempts = this.attempts.get(clientId) || [];
    const validAttempts = clientAttempts.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxAttempts - validAttempts.length);
  }
};

/**
 * Generate client fingerprint for rate limiting
 */
function generateClientFingerprint(req) {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';
  const acceptLanguage = req.get('Accept-Language') || '';
  
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${ip}-${userAgent}-${acceptLanguage}`)
    .digest('hex');
    
  return fingerprint;
}

/**
 * Validate pricing request parameters
 */
function validatePricingRequest(req, res, next) {
  const { propertyId, checkIn, checkOut, guests } = req.body;
  const errors = [];
  
  // Required fields validation
  if (!propertyId) {
    errors.push('Property ID is required');
  }
  
  if (!checkIn) {
    errors.push('Check-in date is required');
  }
  
  if (!checkOut) {
    errors.push('Check-out date is required');
  }
  
  if (!guests || !guests.adults) {
    errors.push('Guest count is required');
  }
  
  // Date validation
  if (checkIn && checkOut) {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const now = new Date();
    
    if (isNaN(checkInDate.getTime())) {
      errors.push('Invalid check-in date format');
    }
    
    if (isNaN(checkOutDate.getTime())) {
      errors.push('Invalid check-out date format');
    }
    
    // FIXED: Normalize to date-only for comparison so same-day check-in is allowed
    const checkInDateOnly = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate());
    const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (checkInDateOnly < todayOnly) {
      errors.push('Check-in date cannot be in the past');
    }
    
    if (checkOutDate <= checkInDate) {
      errors.push('Check-out date must be after check-in date');
    }
    
    // Check for reasonable booking duration (max 1 year)
    const maxDuration = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (checkOutDate - checkInDate > maxDuration) {
      errors.push('Booking duration cannot exceed 1 year');
    }
  }
  
  // Guest validation
  if (guests) {
    const { adults, children = 0, infants = 0 } = guests;
    
    if (adults < 1 || adults > 20) {
      errors.push('Adult count must be between 1 and 20');
    }
    
    if (children < 0 || children > 10) {
      errors.push('Children count must be between 0 and 10');
    }
    
    if (infants < 0 || infants > 5) {
      errors.push('Infants count must be between 0 and 5');
    }
    
    if (adults + children + infants > 25) {
      errors.push('Total guest count cannot exceed 25');
    }
  }
  
  // Hourly extension validation
  if (req.body.hourlyExtension) {
    const validHours = [6, 12, 18];
    if (!validHours.includes(req.body.hourlyExtension)) {
      errors.push('Hourly extension must be 6, 12, or 18 hours');
    }
  }
  
  // Extension hours validation
  if (req.body.extensionHours) {
    if (req.body.extensionHours < 0 || req.body.extensionHours > 24) {
      errors.push('Extension hours must be between 0 and 24');
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid pricing request parameters',
      errors
    });
  }
  
  next();
}

/**
 * Rate limiting middleware for pricing calculations
 */
function rateLimitPricing(req, res, next) {
  const clientId = generateClientFingerprint(req);
  
  if (!pricingRateLimit.isAllowed(clientId)) {
    const remainingAttempts = pricingRateLimit.getRemainingAttempts(clientId);
    return res.status(429).json({
      success: false,
      message: 'Too many pricing calculation requests',
      retryAfter: Math.ceil(pricingRateLimit.windowMs / 1000),
      remainingAttempts
    });
  }
  
  next();
}

/**
 * Generate secure pricing token
 */
function generatePricingToken(pricingData) {
  const data = JSON.stringify(pricingData);
  const hash = crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(data)
    .digest('hex');
  return hash;
}

/**
 * Verify pricing token
 */
function verifyPricingToken(pricingData, token) {
  const expectedToken = generatePricingToken(pricingData);
  return crypto.timingSafeEqual(
    Buffer.from(token, 'hex'),
    Buffer.from(expectedToken, 'hex')
  );
}

/**
 * Log pricing calculation attempts for security monitoring
 */
function logPricingAttempt(req, res, next) {
  const clientId = generateClientFingerprint(req);
  const { propertyId, checkIn, checkOut, guests } = req.body;
  
  console.log('🔍 Pricing calculation attempt:', {
    clientId: clientId.substring(0, 8) + '...',
    propertyId,
    checkIn,
    checkOut,
    guests,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  
  next();
}

/**
 * Validate property access permissions
 */
async function validatePropertyAccess(req, res, next) {
  const { propertyId } = req.body;
  
  try {
    const Property = require('../models/Property');
    const property = await Property.findById(propertyId);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }
    
    // Check if property is available for booking
    if (property.status !== 'published' && property.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Property is not available for booking'
      });
    }
    
    // Check if property is approved
    if (property.approvalStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Property is not approved for booking'
      });
    }
    
    // Add property to request for use in pricing calculation
    req.property = property;
    next();
  } catch (error) {
    console.error('Error validating property access:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating property access'
    });
  }
}

module.exports = {
  validatePricingRequest,
  rateLimitPricing,
  generatePricingToken,
  verifyPricingToken,
  logPricingAttempt,
  validatePropertyAccess,
  pricingRateLimit
};
