const Joi = require('joi');

// Create booking validation
const validateBooking = (req, res, next) => {
  
  const schema = Joi.object({
    propertyId: Joi.string()
      .optional()
      .messages({
        'string.base': 'Property ID must be a string'
      }),
    listingId: Joi.string()
      .optional()
      .messages({
        'string.base': 'Listing ID must be a string'
      }),
    serviceId: Joi.string()
      .optional()
      .messages({
        'string.base': 'Service ID must be a string'
      }),
    checkIn: Joi.date()
      .greater('now')
      .required()
      .messages({
        'date.greater': 'Check-in date must be in the future',
        'any.required': 'Check-in date is required'
      }),
    checkOut: Joi.date()
      .greater(Joi.ref('checkIn'))
      .required()
      .messages({
        'date.greater': 'Check-out date must be after check-in date',
        'any.required': 'Check-out date is required'
      }),
    guests: Joi.object({
      adults: Joi.number()
        .min(1)
        .max(20)
        .required()
        .messages({
          'number.min': 'At least 1 adult is required',
          'number.max': 'Maximum 20 adults allowed',
          'any.required': 'Number of adults is required'
        }),
      children: Joi.number()
        .min(0)
        .max(10)
        .default(0)
        .messages({
          'number.min': 'Children count cannot be negative',
          'number.max': 'Maximum 10 children allowed'
        }),
      infants: Joi.number()
        .min(0)
        .max(5)
        .default(0)
        .messages({
          'number.min': 'Infants count cannot be negative',
          'number.max': 'Maximum 5 infants allowed'
        })
    }).required(),
    specialRequests: Joi.string()
      .max(1000)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Special requests cannot exceed 1000 characters'
      }),
    contactInfo: Joi.object({
      name: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
          'string.min': 'Contact name must be at least 2 characters',
          'string.max': 'Contact name cannot exceed 100 characters',
          'any.required': 'Contact name is required'
        }),
      phone: Joi.string()
        .pattern(/^\+?[\d\s\-\(\)]+$/)
        .required()
        .messages({
          'string.pattern.base': 'Please provide a valid phone number',
          'any.required': 'Phone number is required'
        }),
      email: Joi.string()
        .email()
        .required()
        .messages({
          'string.email': 'Please provide a valid email address',
          'any.required': 'Email address is required'
        })
    }).required(),
    paymentMethod: Joi.string()
      .valid('card', 'paypal', 'apple_pay', 'google_pay')
      .optional()
      .messages({
        'any.only': 'Payment method must be one of: card, paypal, apple_pay, google_pay'
      }),
    couponCode: Joi.string()
      .max(20)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Coupon code cannot exceed 20 characters'
      }),
    agreeToTerms: Joi.boolean()
      .optional()
      .messages({
        'boolean.base': 'Terms agreement must be a boolean value'
      }),
    hourlyExtension: Joi.object({
      hours: Joi.number()
        .valid(6, 12, 18)
        .optional()
        .messages({
          'any.only': 'Hourly extension must be 6, 12, or 18 hours'
        }),
      rate: Joi.number()
        .min(0)
        .max(1)
        .optional()
        .messages({
          'number.min': 'Hourly rate must be between 0 and 1',
          'number.max': 'Hourly rate must be between 0 and 1'
        }),
      totalHours: Joi.number()
        .min(0)
        .optional()
        .messages({
          'number.min': 'Total hours cannot be negative'
        })
    }).optional(),
    // Security fields
    idempotencyKey: Joi.string()
      .optional()
      .messages({
        'string.base': 'Idempotency key must be a string'
      }),
    paymentData: Joi.object({
      amount: Joi.number()
        .min(0.01)
        .optional()
        .messages({
          'number.min': 'Payment amount must be greater than 0'
        }),
      currency: Joi.string()
        .valid('INR', 'USD', 'EUR', 'GBP')
        .optional()
        .messages({
          'any.only': 'Currency must be one of: INR, USD, EUR, GBP'
        }),
      subtotal: Joi.number()
        .min(0)
        .optional()
        .messages({
          'number.min': 'Subtotal cannot be negative'
        }),
      platformFee: Joi.number()
        .min(0)
        .optional()
        .messages({
          'number.min': 'Platform fee cannot be negative'
        }),
      gst: Joi.number()
        .min(0)
        .optional()
        .messages({
          'number.min': 'GST cannot be negative'
        }),
      processingFee: Joi.number()
        .min(0)
        .optional()
        .messages({
          'number.min': 'Processing fee cannot be negative'
        }),
      discountAmount: Joi.number()
        .min(0)
        .optional()
        .messages({
          'number.min': 'Discount amount cannot be negative'
        })
    }).optional(),
    securityMetadata: Joi.object({
      userAgent: Joi.string()
        .optional()
        .messages({
          'string.base': 'User agent must be a string'
        }),
      timestamp: Joi.string()
        .optional()
        .messages({
          'string.base': 'Timestamp must be a string'
        }),
      clientVersion: Joi.string()
        .optional()
        .messages({
          'string.base': 'Client version must be a string'
        })
    }).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  // Custom validation: ensure at least one of propertyId, listingId, or serviceId is provided
  const { propertyId, listingId, serviceId } = req.body;
  if (!propertyId && !listingId && !serviceId) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: [{
        field: 'booking',
        message: 'Either propertyId, listingId, or serviceId is required'
      }]
    });
  }

  // Ensure only one type of booking is provided
  const bookingTypes = [propertyId, listingId, serviceId].filter(Boolean);
  if (bookingTypes.length > 1) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: [{
        field: 'booking',
        message: 'Cannot book both property and service in one booking'
      }]
    });
  }

  next();
};

// Update booking validation
const validateBookingUpdate = (req, res, next) => {
  const schema = Joi.object({
    checkIn: Joi.date()
      .greater('now')
      .optional()
      .messages({
        'date.greater': 'Check-in date must be in the future'
      }),
    checkOut: Joi.date()
      .greater(Joi.ref('checkIn'))
      .optional()
      .messages({
        'date.greater': 'Check-out date must be after check-in date'
      }),
    guests: Joi.object({
      adults: Joi.number()
        .min(1)
        .max(20)
        .optional()
        .messages({
          'number.min': 'At least 1 adult is required',
          'number.max': 'Maximum 20 adults allowed'
        }),
      children: Joi.number()
        .min(0)
        .max(10)
        .optional()
        .messages({
          'number.min': 'Children count cannot be negative',
          'number.max': 'Maximum 10 children allowed'
        }),
      infants: Joi.number()
        .min(0)
        .max(5)
        .optional()
        .messages({
          'number.min': 'Infants count cannot be negative',
          'number.max': 'Maximum 5 infants allowed'
        })
    }).optional(),
    specialRequests: Joi.string()
      .max(1000)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Special requests cannot exceed 1000 characters'
      }),
    contactInfo: Joi.object({
      name: Joi.string()
        .min(2)
        .max(100)
        .optional()
        .messages({
          'string.min': 'Contact name must be at least 2 characters',
          'string.max': 'Contact name cannot exceed 100 characters'
        }),
      phone: Joi.string()
        .pattern(/^\+?[\d\s\-\(\)]+$/)
        .optional()
        .messages({
          'string.pattern.base': 'Please provide a valid phone number'
        }),
      email: Joi.string()
        .email()
        .optional()
        .messages({
          'string.email': 'Please provide a valid email address'
        })
    }).optional(),
    hourlyExtension: Joi.object({
      hours: Joi.number()
        .valid(6, 12, 18)
        .optional()
        .messages({
          'any.only': 'Hourly extension must be 6, 12, or 18 hours'
        }),
      rate: Joi.number()
        .min(0)
        .max(1)
        .optional()
        .messages({
          'number.min': 'Hourly rate must be between 0 and 1',
          'number.max': 'Hourly rate must be between 0 and 1'
        }),
      totalHours: Joi.number()
        .min(0)
        .optional()
        .messages({
          'number.min': 'Total hours cannot be negative'
        })
    }).optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  next();
};

// Booking status update validation
const validateBookingStatusUpdate = (req, res, next) => {
  const schema = Joi.object({
    status: Joi.string()
      .valid('pending', 'confirmed', 'cancelled', 'completed', 'no_show')
      .required()
      .messages({
        'any.only': 'Status must be one of: pending, confirmed, cancelled, completed, no_show',
        'any.required': 'Status is required'
      }),
    reason: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Reason cannot exceed 500 characters'
      })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  next();
};

// Calculate price validation
const validatePriceCalculation = (req, res, next) => {
  const schema = Joi.object({
    propertyId: Joi.string()
      .required()
      .messages({
        'any.required': 'Property ID is required'
      }),
    serviceId: Joi.string()
      .optional()
      .messages({
        'string.base': 'Service ID must be a string'
      }),
    checkIn: Joi.date()
      .greater('now')
      .required()
      .messages({
        'date.greater': 'Check-in date must be in the future',
        'any.required': 'Check-in date is required'
      }),
    checkOut: Joi.date()
      .greater(Joi.ref('checkIn'))
      .required()
      .messages({
        'date.greater': 'Check-out date must be after check-in date',
        'any.required': 'Check-out date is required'
      }),
    guests: Joi.object({
      adults: Joi.number()
        .min(1)
        .max(20)
        .required()
        .messages({
          'number.min': 'At least 1 adult is required',
          'number.max': 'Maximum 20 adults allowed',
          'any.required': 'Number of adults is required'
        }),
      children: Joi.number()
        .min(0)
        .max(10)
        .default(0)
        .messages({
          'number.min': 'Children count cannot be negative',
          'number.max': 'Maximum 10 children allowed'
        }),
      infants: Joi.number()
        .min(0)
        .max(5)
        .default(0)
        .messages({
          'number.min': 'Infants count cannot be negative',
          'number.max': 'Maximum 5 infants allowed'
        })
    }).required(),
    couponCode: Joi.string()
      .max(20)
      .optional()
      .messages({
        'string.max': 'Coupon code cannot exceed 20 characters'
      })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  next();
};

// Apply coupon validation
const validateApplyCoupon = (req, res, next) => {
  const schema = Joi.object({
    couponCode: Joi.string()
      .max(20)
      .required()
      .messages({
        'string.max': 'Coupon code cannot exceed 20 characters',
        'any.required': 'Coupon code is required'
      })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  next();
};

// Booking query validation
const validateBookingQuery = (req, res, next) => {
  const schema = Joi.object({
    status: Joi.string()
      .valid('pending', 'confirmed', 'cancelled', 'completed', 'no_show')
      .optional()
      .messages({
        'any.only': 'Status must be one of: pending, confirmed, cancelled, completed, no_show'
      }),
    startDate: Joi.date()
      .optional()
      .messages({
        'date.base': 'Start date must be a valid date'
      }),
    endDate: Joi.date()
      .greater(Joi.ref('startDate'))
      .optional()
      .messages({
        'date.base': 'End date must be a valid date',
        'date.greater': 'End date must be after start date'
      }),
    page: Joi.number()
      .min(1)
      .default(1)
      .messages({
        'number.min': 'Page must be at least 1'
      }),
    limit: Joi.number()
      .min(1)
      .max(100)
      .default(10)
      .messages({
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      }),
    sortBy: Joi.string()
      .valid('createdAt', 'checkIn', 'checkOut', 'totalAmount')
      .default('createdAt')
      .messages({
        'any.only': 'Sort by must be one of: createdAt, checkIn, checkOut, totalAmount'
      }),
    sortOrder: Joi.string()
      .valid('asc', 'desc')
      .default('desc')
      .messages({
        'any.only': 'Sort order must be either asc or desc'
      })
  });

  const { error } = schema.validate(req.query);
  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }

  next();
};

module.exports = {
  validateBooking,
  validateBookingUpdate,
  validateBookingStatusUpdate,
  validatePriceCalculation,
  validateApplyCoupon,
  validateBookingQuery
}; 