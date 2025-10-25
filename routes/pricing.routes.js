const express = require('express');
const router = express.Router();
const { calculatePricingBreakdown } = require('../config/pricing.config');
const { calculate24HourPricing, calculateTotalHours, calculateCheckoutTime, validate24HourBooking } = require('../utils/pricingUtils');
const { toTwoDecimals } = require('../config/pricing.config');
const Property = require('../models/Property');
const Service = require('../models/Service');
const Coupon = require('../models/Coupon');

/**
 * @desc    Calculate pricing for property booking
 * @route   POST /api/pricing/calculate
 * @access  Public (for property details page)
 */
router.post('/calculate', async (req, res) => {
  try {
    const {
      propertyId,
      checkIn,
      checkOut,
      guests = { adults: 1, children: 0 },
      hourlyExtension = 0,
      couponCode,
      bookingType = 'daily', // 'daily' or '24hour'
      checkInDateTime,
      extensionHours = 0
    } = req.body;

    // Validate required fields
    if (!propertyId || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: 'Property ID, check-in, and check-out dates are required'
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

    // Debug: Log the received dates
    console.log('🔍 Backend received dates:', { checkIn, checkOut });
    
    // Calculate nights properly for accommodation bookings
    // Count actual nights stayed (Nov 2 to Nov 6 = 4 nights)
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    console.log('🔍 Parsed dates:', { checkInDate, checkOutDate });
    
    // Strip time components to get date-only comparison
    const checkInDateOnly = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate());
    const checkOutDateOnly = new Date(checkOutDate.getFullYear(), checkOutDate.getMonth(), checkOutDate.getDate());
    
    console.log('🔍 Date-only comparison:', { checkInDateOnly, checkOutDateOnly });
    
    const diffTime = checkOutDateOnly - checkInDateOnly;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const nights = Math.max(0, diffDays);
    
    console.log('🔍 Nights calculation:', { diffTime, diffDays, nights });
    
    // Determine if this is a 24-hour booking
    const is24HourBooking = bookingType === '24hour' || property.enable24HourBooking || property.pricing?.basePrice24Hour > 0;

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

    if (is24HourBooking) {
      // 24-hour booking logic
      const totalHours = calculateTotalHours(24, extensionHours);
      const checkOutDateTime = checkInDateTime ? calculateCheckoutTime(new Date(checkInDateTime), totalHours) : null;
      
      // Validate 24-hour booking parameters
      if (checkInDateTime) {
        const validation = validate24HourBooking({
          checkInDateTime: new Date(checkInDateTime),
          totalHours,
          minHours: property.availabilitySettings?.minBookingHours || 24,
          maxHours: property.availabilitySettings?.maxBookingHours || 168
        });

        if (!validation.isValid) {
          return res.status(400).json({
            success: false,
            message: 'Invalid 24-hour booking parameters',
            errors: validation.errors
          });
        }
      }

      // Set 24-hour pricing parameters
      pricingParams.basePrice24Hour = property.pricing?.basePrice24Hour || property.pricing?.basePrice;
      pricingParams.totalHours = totalHours;
      
      // Add extension cost if applicable
      if (extensionHours && extensionHours > 0) {
        const extensionCost = calculateHourlyExtension(property.pricing?.basePrice24Hour || property.pricing?.basePrice, extensionHours);
        pricingParams.hourlyExtension = extensionCost;
      }
    } else {
      // Regular daily booking logic
      // Add hourly extension cost if applicable
      if (hourlyExtension && hourlyExtension > 0 && property.hourlyBooking?.enabled) {
        const extensionCost = calculateHourlyExtension(property.pricing?.basePrice, hourlyExtension);
        pricingParams.hourlyExtension = extensionCost;
      }
    }

    // Apply coupon if provided
    let couponApplied = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validTo: { $gte: new Date() }
      });
      
      if (coupon) {
        // Calculate subtotal first to apply coupon discount
        const tempPricing = await calculatePricingBreakdown(pricingParams);
        let discountAmount = 0;
        
        if (coupon.discountType === 'percentage') {
          discountAmount = (tempPricing.subtotal * coupon.amount) / 100;
          const maxDiscount = coupon.maxDiscount || discountAmount;
          discountAmount = Math.min(discountAmount, maxDiscount);
        } else {
          discountAmount = coupon.amount;
        }
        
        pricingParams.discountAmount = discountAmount;
        couponApplied = {
          id: coupon._id,
          code: coupon.code,
          discountAmount: discountAmount,
          discountType: coupon.discountType
        };
      }
    }

    // Calculate final pricing breakdown
    const pricing = await calculatePricingBreakdown(pricingParams);

    // Return pricing data
    res.json({
      success: true,
      data: {
        pricing: {
          baseAmount: pricing.baseAmount,
          nights: pricing.nights || 1,
          totalHours: pricing.totalHours,
          extraGuests: pricing.extraGuests,
          extraGuestCost: pricing.extraGuestCost,
          cleaningFee: pricing.cleaningFee,
          serviceFee: pricing.serviceFee,
          securityDeposit: pricing.securityDeposit,
          hostFees: pricing.hostFees,
          hourlyExtension: pricing.hourlyExtension,
          discountAmount: pricing.discountAmount,
          subtotal: pricing.subtotal,
          hostSubtotal: pricing.hostSubtotal,
          platformFee: pricing.platformFee,
          processingFee: pricing.processingFee,
          platformRevenue: pricing.platformRevenue,
          gst: pricing.gst,
          totalAmount: pricing.totalAmount,
          hostEarning: pricing.hostEarning,
          currency: pricing.currency,
          platformFeeRate: pricing.platformFeeRate,
          breakdown: pricing.breakdown
        },
        property: {
          id: property._id,
          title: property.title,
          basePrice: property.pricing?.basePrice,
          basePrice24Hour: property.pricing?.basePrice24Hour,
          enable24HourBooking: property.enable24HourBooking,
          hourlyBooking: property.hourlyBooking
        },
        booking: {
          checkIn,
          checkOut,
          checkInDateTime,
          checkOutDateTime: is24HourBooking && checkInDateTime ? calculateCheckoutTime(new Date(checkInDateTime), pricingParams.totalHours) : null,
          guests,
          nights,
          totalHours: pricingParams.totalHours,
          bookingType: is24HourBooking ? '24hour' : 'daily'
        },
        coupon: couponApplied
      }
    });

  } catch (error) {
    console.error('Error calculating pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating pricing',
      error: error.message
    });
  }
});

/**
 * @desc    Get platform fee rate
 * @route   GET /api/pricing/platform-fee-rate
 * @access  Public
 */
router.get('/platform-fee-rate', async (req, res) => {
  try {
    const PricingConfig = require('../models/PricingConfig');
    const config = await PricingConfig.findOne().sort({ createdAt: -1 });
    
    const rate = config?.platformFeeRate || 0.15; // Default 15%
    
    res.json({
      success: true,
      data: {
        rate: rate,
        ratePercentage: (rate * 100).toFixed(1)
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
});

/**
 * @desc    Validate coupon code
 * @route   POST /api/pricing/validate-coupon
 * @access  Public
 */
router.post('/validate-coupon', async (req, res) => {
  try {
    const { couponCode, propertyId, checkIn, checkOut, guests = { adults: 1, children: 0 } } = req.body;

    if (!couponCode) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required'
      });
    }

    // Get property details for pricing calculation
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Find coupon
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validTo: { $gte: new Date() }
    });

    if (!coupon) {
      return res.json({
        success: false,
        message: 'Invalid or expired coupon code'
      });
    }

    // Calculate pricing to determine discount amount
    // Calculate nights properly for accommodation bookings
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    // Strip time components to get date-only comparison
    const checkInDateOnly = new Date(checkInDate.getFullYear(), checkInDate.getMonth(), checkInDate.getDate());
    const checkOutDateOnly = new Date(checkOutDate.getFullYear(), checkOutDate.getMonth(), checkOutDate.getDate());
    
    const diffTime = checkOutDateOnly - checkInDateOnly;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const nights = Math.max(0, diffDays);
    const is24HourBooking = property.enable24HourBooking || property.pricing?.basePrice24Hour > 0;

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

    if (is24HourBooking) {
      pricingParams.basePrice24Hour = property.pricing?.basePrice24Hour || property.pricing?.basePrice;
      pricingParams.totalHours = 24;
    }

    const tempPricing = await calculatePricingBreakdown(pricingParams);
    
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (tempPricing.subtotal * coupon.amount) / 100;
      const maxDiscount = coupon.maxDiscount || discountAmount;
      discountAmount = Math.min(discountAmount, maxDiscount);
    } else {
      discountAmount = coupon.amount;
    }

    res.json({
      success: true,
      data: {
        coupon: {
          id: coupon._id,
          code: coupon.code,
          discountType: coupon.discountType,
          amount: coupon.amount,
          maxDiscount: coupon.maxDiscount,
          discountAmount: toTwoDecimals(discountAmount),
          description: coupon.description
        },
        pricing: {
          subtotal: tempPricing.subtotal,
          discountAmount: toTwoDecimals(discountAmount),
          finalAmount: toTwoDecimals(tempPricing.subtotal - discountAmount)
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
});

module.exports = router;
