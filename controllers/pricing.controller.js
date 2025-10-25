const Property = require('../models/Property');
const PricingConfig = require('../models/PricingConfig');
const Coupon = require('../models/Coupon');
const { calculate24HourPricing, calculatePricingBreakdown } = require('../utils/pricingUtils');

// @desc    Get platform fee rate
// @route   GET /api/pricing/platform-fee-rate
// @access  Public
const getPlatformFeeRate = async (req, res) => {
  try {
    // Get the latest pricing configuration
    const pricingConfig = await PricingConfig.findOne().sort({ createdAt: -1 });
    
    if (!pricingConfig) {
      return res.status(404).json({
        success: false,
        message: 'Pricing configuration not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        rate: pricingConfig.platformFeeRate,
        ratePercentage: `${(pricingConfig.platformFeeRate * 100).toFixed(1)}%`
      }
    });
  } catch (error) {
    console.error('Error fetching platform fee rate:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching platform fee rate',
      error: error.message
    });
  }
};

// @desc    Calculate pricing for a booking
// @route   POST /api/pricing/calculate
// @access  Private
const calculatePricing = async (req, res) => {
  try {
    const {
      propertyId,
      checkIn,
      checkOut,
      guests,
      hourlyExtension = 0,
      couponCode,
      bookingType = 'daily',
      checkInDateTime,
      extensionHours = 0
    } = req.body;

    // Validate required fields
    if (!propertyId || !checkIn || !checkOut || !guests) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: propertyId, checkIn, checkOut, guests'
      });
    }

    // Get property details
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Get pricing configuration
    const pricingConfig = await PricingConfig.findOne().sort({ createdAt: -1 });
    if (!pricingConfig) {
      return res.status(500).json({
        success: false,
        message: 'Pricing configuration not found'
      });
    }

    // Calculate nights or hours based on booking type
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const totalHours = bookingType === '24hour' ? (24 + extensionHours) : (nights * 24);

    // Determine base price
    let basePrice;
    if (bookingType === '24hour' && property.pricing?.basePrice24Hour) {
      basePrice = property.pricing.basePrice24Hour;
    } else {
      basePrice = property.pricing?.basePrice || 0;
    }

    // Calculate extra guest cost
    const extraGuests = Math.max(0, (guests.adults || 0) - (property.maxGuests || 1));
    const extraGuestCost = extraGuests * (property.pricing?.extraGuestPrice || 0);

    // Calculate pricing breakdown
    let pricingBreakdown;
    if (bookingType === '24hour') {
      pricingBreakdown = calculate24HourPricing({
        basePrice24Hour: basePrice,
        totalHours,
        extraGuestPrice: property.pricing?.extraGuestPrice || 0,
        extraGuests,
        cleaningFee: property.pricing?.cleaningFee || 0,
        serviceFee: property.pricing?.serviceFee || 0,
        securityDeposit: property.pricing?.securityDeposit || 0,
        hourlyExtension: hourlyExtension,
        discountAmount: 0, // Will be calculated if coupon is applied
        currency: 'INR',
        platformFeeRate: pricingConfig.platformFeeRate
      });
    } else {
      pricingBreakdown = calculatePricingBreakdown({
        basePrice,
        nights,
        extraGuestPrice: property.pricing?.extraGuestPrice || 0,
        extraGuests,
        cleaningFee: property.pricing?.cleaningFee || 0,
        serviceFee: property.pricing?.serviceFee || 0,
        securityDeposit: property.pricing?.securityDeposit || 0,
        hourlyExtension: hourlyExtension,
        discountAmount: 0, // Will be calculated if coupon is applied
        currency: 'INR',
        platformFeeRate: pricingConfig.platformFeeRate
      });
    }

    // Apply coupon discount if provided
    let discountAmount = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({ 
        code: couponCode,
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() }
      });

      if (coupon) {
        if (coupon.discountType === 'percentage') {
          discountAmount = (pricingBreakdown.subtotal * coupon.discountValue) / 100;
        } else {
          discountAmount = coupon.discountValue;
        }
        
        // Update pricing breakdown with discount
        pricingBreakdown.discountAmount = discountAmount;
        pricingBreakdown.subtotal = pricingBreakdown.subtotal - discountAmount;
        pricingBreakdown.totalAmount = pricingBreakdown.subtotal + pricingBreakdown.platformFee + pricingBreakdown.gst + pricingBreakdown.processingFee;
      }
    }

    // Prepare response
    const response = {
      baseAmount: basePrice,
      nights: bookingType === 'daily' ? nights : undefined,
      totalHours: bookingType === '24hour' ? totalHours : undefined,
      extraGuests,
      extraGuestCost,
      cleaningFee: pricingBreakdown.cleaningFee,
      serviceFee: pricingBreakdown.serviceFee,
      securityDeposit: pricingBreakdown.securityDeposit,
      hostFees: pricingBreakdown.hostFees,
      hourlyExtension: pricingBreakdown.hourlyExtension,
      discountAmount: pricingBreakdown.discountAmount,
      subtotal: pricingBreakdown.subtotal,
      hostSubtotal: pricingBreakdown.hostSubtotal,
      platformFee: pricingBreakdown.platformFee,
      processingFee: pricingBreakdown.processingFee,
      platformRevenue: pricingBreakdown.platformRevenue,
      gst: pricingBreakdown.gst,
      totalAmount: pricingBreakdown.totalAmount,
      hostEarning: pricingBreakdown.hostEarning,
      currency: 'INR',
      platformFeeRate: pricingConfig.platformFeeRate,
      breakdown: pricingBreakdown.breakdown
    };

    res.status(200).json({
      success: true,
      data: { pricing: response }
    });

  } catch (error) {
    console.error('Error calculating pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating pricing',
      error: error.message
    });
  }
};

// @desc    Validate coupon code
// @route   POST /api/pricing/validate-coupon
// @access  Private
const validateCoupon = async (req, res) => {
  try {
    const { couponCode, propertyId, checkIn, checkOut, guests } = req.body;

    if (!couponCode || !propertyId) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code and property ID are required'
      });
    }

    // Find active coupon
    const coupon = await Coupon.findOne({
      code: couponCode,
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired coupon code'
      });
    }

    // Check if coupon is applicable to this property
    if (coupon.applicableProperties && coupon.applicableProperties.length > 0) {
      if (!coupon.applicableProperties.includes(propertyId)) {
        return res.status(400).json({
          success: false,
          message: 'This coupon is not applicable to the selected property'
        });
      }
    }

    // Calculate discount amount (simplified for validation)
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    
    // Get property for base price calculation
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const basePrice = property.pricing?.basePrice || 0;
    const subtotal = basePrice * nights; // Simplified calculation for validation
    
    let discountAmount;
    if (coupon.discountType === 'percentage') {
      discountAmount = (subtotal * coupon.discountValue) / 100;
    } else {
      discountAmount = Math.min(coupon.discountValue, subtotal);
    }

    res.status(200).json({
      success: true,
      data: {
        coupon: {
          code: coupon.code,
          discountAmount: Math.round(discountAmount * 100) / 100,
          discountType: coupon.discountType,
          description: coupon.description || `Get ${coupon.discountValue}${coupon.discountType === 'percentage' ? '%' : '₹'} off your booking`
        }
      }
    });

  } catch (error) {
    console.error('Error validating coupon:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating coupon',
      error: error.message
    });
  }
};

module.exports = {
  getPlatformFeeRate,
  calculatePricing,
  validateCoupon
};
