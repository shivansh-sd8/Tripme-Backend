/**
 * Secure Pricing Routes
 * All pricing calculations with comprehensive security measures
 */

const express = require('express');
const router = express.Router();
const { 
  validatePricingRequest, 
  rateLimitPricing, 
  logPricingAttempt, 
  validatePropertyAccess 
} = require('../middlewares/pricingSecurity.middleware');
const { 
  calculateSecurePricing, 
  validatePricingToken, 
  getPricingConfig 
} = require('../controllers/securePricing.controller');
const { auth } = require('../middlewares/auth.middleware');

/**
 * @desc    Calculate secure pricing for property booking
 * @route   POST /api/secure-pricing/calculate
 * @access  Public (no authentication required for pricing)
 */
router.post('/calculate', 
  logPricingAttempt, // Log for security monitoring
  rateLimitPricing, // Rate limiting
  validatePricingRequest, // Validate request parameters
  validatePropertyAccess, // Validate property access
  calculateSecurePricing // Calculate pricing
);

/**
 * @desc    Validate pricing token
 * @route   POST /api/secure-pricing/validate-token
 * @access  Private
 */
router.post('/validate-token', 
  auth, // Require authentication
  validatePricingToken
);

/**
 * @desc    Get pricing configuration (public rates only)
 * @route   GET /api/secure-pricing/config
 * @access  Public
 */
router.get('/config', getPricingConfig);

module.exports = router;
