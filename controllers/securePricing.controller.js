/**
 * Secure Pricing Controller
 * All pricing calculations happen server-side with comprehensive validation
 */

const { calculateUnifiedPricing } = require('../utils/unifiedPricing'); // UNIFIED PRICING SYSTEM
const Property = require('../models/Property');
const Coupon = require('../models/Coupon');
const { generatePricingToken } = require('../middlewares/pricingSecurity.middleware');

/**
 * @desc    Calculate secure pricing for property booking
 * @route   POST /api/secure-pricing/calculate
 * @access  Private (requires authentication)
 */
const calculateSecurePricing = async (req, res) => {
  try {
    const {
      propertyId,
      checkIn,
      checkOut,
      guests = { adults: 1, children: 0 },
      hourlyExtension = 0,
      couponCode,
      bookingType = 'daily',
      checkInDateTime,
      extensionHours = 0
    } = req.body;

    // Get property from middleware (already validated)
    const property = req.property;

    // Calculate nights properly for accommodation bookings
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    // Strip time components to get date-only comparison
    const checkInDateOnly = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate());
    const checkOutDateOnly = new Date(checkOutDate.getFullYear(), checkOutDate.getMonth(), checkOutDate.getDate());
    
    const diffTime = checkOutDateOnly - checkInDateOnly;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const nights = Math.max(0, diffDays);
    
    console.log('🔍 Secure pricing calculation:', { 
      propertyId, 
      checkIn, 
      checkOut, 
      nights,
      guests,
      bookingType 
    });

    // Determine if this is a 24-hour booking
    const is24HourBooking = bookingType === '24hour' || property.enable24HourBooking || property.pricing?.basePrice24Hour > 0;

    // Prepare pricing parameters for UNIFIED PRICING SYSTEM
    let pricingParams = {
      basePrice: property.pricing?.basePrice || 0,
      nights,
      cleaningFee: property.pricing?.cleaningFee || 0,
      serviceFee: property.pricing?.serviceFee || 0,
      securityDeposit: property.pricing?.securityDeposit || 0,
      extraGuestPrice: property.pricing?.extraGuestPrice || 0,
      extraGuests: guests.adults > 1 ? guests.adults - 1 : 0,
      hourlyExtension: 0,
      discountAmount: 0,
      currency: property.pricing?.currency || 'INR',
      bookingType: is24HourBooking ? '24hour' : 'daily'
    };

    // Handle 24-hour booking pricing
    if (is24HourBooking) {
      pricingParams.basePrice24Hour = property.pricing?.basePrice24Hour || property.pricing?.basePrice;
      pricingParams.totalHours = 24 + (extensionHours || 0);
      pricingParams.extensionHours = extensionHours || 0;
    }

    // Calculate pricing using UNIFIED SYSTEM (BACKEND ONLY)
    const pricingBreakdown = await calculateUnifiedPricing(pricingParams);

    // Apply coupon discount if provided
    let couponData = null;
    if (couponCode) {
      try {
        const coupon = await Coupon.findOne({ 
          code: couponCode,
          isActive: true,
          validFrom: { $lte: new Date() },
          validUntil: { $gte: new Date() }
        });

        if (coupon) {
          let discountAmount = 0;
          if (coupon.discountType === 'percentage') {
            discountAmount = (pricingBreakdown.hostSubtotal * coupon.amount) / 100;
            const maxDiscount = coupon.maxDiscount || discountAmount;
            discountAmount = Math.min(discountAmount, maxDiscount);
          } else {
            discountAmount = Math.min(coupon.amount, pricingBreakdown.hostSubtotal);
          }

          // Recalculate pricing with discount using UNIFIED SYSTEM
          const discountedParams = {
            ...pricingParams,
            discountAmount: discountAmount
          };
          const discountedPricing = await calculateUnifiedPricing(discountedParams);
          
          // Update pricing breakdown with discounted values
          Object.assign(pricingBreakdown, discountedPricing);

          couponData = {
            id: coupon._id,
            code: coupon.code,
            discountType: coupon.discountType,
            amount: coupon.amount,
            maxDiscount: coupon.maxDiscount,
            discountAmount: toTwoDecimals(discountAmount),
            description: coupon.description
          };
        }
      } catch (error) {
        console.error('Error applying coupon:', error);
        // Continue without coupon if there's an error
      }
    }

    // Generate secure pricing token for validation
    const pricingToken = generatePricingToken({
      propertyId,
      checkIn,
      checkOut,
      guests,
      nights,
      totalAmount: pricingBreakdown.totalAmount
    });

    // Prepare response with all calculated values
    const response = {
      success: true,
      data: {
        pricing: {
          basePrice: property.pricing?.basePrice || 0,
          baseAmount: pricingBreakdown.baseAmount,
          nights,
          extraGuestPrice: property.pricing?.extraGuestPrice || 0,
          extraGuests: pricingParams.extraGuests,
          extraGuestCost: pricingBreakdown.extraGuestCost,
          cleaningFee: pricingBreakdown.cleaningFee,
          serviceFee: pricingBreakdown.serviceFee,
          securityDeposit: pricingBreakdown.securityDeposit,
          hourlyExtension: pricingBreakdown.hourlyExtension,
          discountAmount: pricingBreakdown.discountAmount,
          subtotal: pricingBreakdown.subtotal,
          platformFee: pricingBreakdown.platformFee,
          gst: pricingBreakdown.gst,
          processingFee: pricingBreakdown.processingFee,
          totalAmount: pricingBreakdown.totalAmount,
          currency: pricingBreakdown.currency,
          bookingType: pricingParams.bookingType
        },
        coupon: couponData,
        security: {
          pricingToken,
          calculatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
        },
        property: {
          id: property._id,
          title: property.title,
          maxGuests: property.maxGuests,
          minNights: property.minNights,
          checkInTime: property.checkInTime,
          checkOutTime: property.checkOutTime,
          cancellationPolicy: property.cancellationPolicy
        }
      }
    };

    console.log('✅ Secure pricing calculated successfully:', {
      propertyId,
      nights,
      totalAmount: pricingBreakdown.totalAmount,
      pricingToken: pricingToken.substring(0, 8) + '...'
    });

    res.json(response);

  } catch (error) {
    console.error('Error in secure pricing calculation:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating pricing',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc    Validate pricing token
 * @route   POST /api/secure-pricing/validate-token
 * @access  Private
 */
const validatePricingToken = async (req, res) => {
  try {
    const { pricingToken, pricingData } = req.body;

    if (!pricingToken || !pricingData) {
      return res.status(400).json({
        success: false,
        message: 'Pricing token and data are required'
      });
    }

    const { verifyPricingToken } = require('../middlewares/pricingSecurity.middleware');
    const isValid = verifyPricingToken(pricingData, pricingToken);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pricing token'
      });
    }

    res.json({
      success: true,
      message: 'Pricing token is valid'
    });

  } catch (error) {
    console.error('Error validating pricing token:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating pricing token'
    });
  }
};

/**
 * @desc    Get pricing configuration (public rates only)
 * @route   GET /api/secure-pricing/config
 * @access  Public
 */
const getPricingConfig = async (req, res) => {
  try {
    const PricingConfig = require('../models/PricingConfig');
    const config = await PricingConfig.findOne().sort({ createdAt: -1 });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Pricing configuration not found'
      });
    }

    // Return only public configuration (no sensitive rates)
    res.json({
      success: true,
      data: {
        currency: config.currency,
        taxRate: config.taxRate,
        processingFeeRate: config.processingFeeRate,
        processingFeeFixed: config.processingFeeFixed,
        minBookingAmount: config.minBookingAmount,
        maxBookingAmount: config.maxBookingAmount,
        lastUpdated: config.updatedAt
      }
    });

  } catch (error) {
    console.error('Error getting pricing config:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting pricing configuration'
    });
  }
};

module.exports = {
  calculateSecurePricing,
  validatePricingToken,
  getPricingConfig
};
