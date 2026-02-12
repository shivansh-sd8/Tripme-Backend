const mongoose = require('mongoose');
const slugify = require('slugify');

const propertySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please enter a title'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please enter a description'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && // longitude
                 coords[1] >= -90 && coords[1] <= 90;     // latitude
        },
        message: 'Coordinates must be an array of 2 numbers: [longitude, latitude]'
      }
    },
    address: String,
    userAddress: String, // User's own address description
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  type: {
    type: String,
    enum: ['villa', 'apartment', 'hostel', 'house', 'cottage', 'cabin', 'treehouse', 'boat'],
    required: true
  },
  propertyType: {
    type: String,
    enum: ['premium', 'standard', 'budget', 'luxury'],
    default: 'standard'
  },
  style: {
    type: String,
    enum: ['modern', 'traditional', 'minimalist', 'rustic', 'industrial', 'scandinavian', 'mediterranean', 'tropical'],
    default: 'modern'
  },
  placeType: {
    type: String,
    enum: ['entire', 'room', 'shared'],
    default: 'entire'
  },
  images: [{
    url: {
      type: String,
      required: false,
      validate: {
        validator: function(v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Image URL must be a valid HTTP/HTTPS URL'
      }
    },
    publicId: {
      type: String,
      required: false
    },
    isPrimary: {
      type: Boolean,
      default: false
    },
    caption: {
      type: String,
      maxlength: [200, 'Image caption cannot exceed 200 characters'],
      required: false
    },
    width: {
      type: Number,
      min: [0, 'Image width cannot be negative'],
      required: false
    },
    height: {
      type: Number,
      min: [0, 'Image height cannot be negative'],
      required: false
    },
    format: {
      type: String,
      enum: ['jpeg', 'jpg', 'png', 'gif', 'webp'],
      required: false
    },
    size: {
      type: Number,
      min: [0, 'Image size cannot be negative'],
      required: false
    }
  }],
  pricing: {
    basePrice: {
      type: Number,
      required: true,
      min: [1, 'Price must be at least 1']
    },
    // NEW: 24-hour based pricing
    basePrice24Hour: {
      type: Number,
      min: [0, '24-hour price cannot be negative'],
      default: 0
    },
    extraGuestPrice: {
      type: Number,
      default: 0
    },
    cleaningFee: {
      type: Number,
      default: 0
    },
    serviceFee: {
      type: Number,
      default: 0
    },
    securityDeposit: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR']
    },
    weeklyDiscount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    monthlyDiscount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  hourlyBooking: {
    enabled: {
      type: Boolean,
      default: false
    },
    minStayDays: {
      type: Number,
      default: 1,
      min: 1
    },
    hourlyRates: {
      sixHours: {
        type: Number,
        default: 0.30,
        min: 0,
        max: 1
      },
      twelveHours: {
        type: Number,
        default: 0.60,
        min: 0,
        max: 1
      },
      eighteenHours: {
        type: Number,
        default: 0.75,
        min: 0,
        max: 1
      }
    }
  },
  // houseRules: [{
  //   type: String,
  //   // enum: ['no-smoking', 'no-pets', 'no-parties',  'no-unregistered-guests']
  // }],
  houseRules: {
  common: [{
    type: String
  }],
  additional: {
    type: Object,
    default: {}
  },
  default: { common: [], additional: {} }
},
  checkInTime: {
    type: String,
    default: '15:00'
  },
  checkOutTime: {
    type: String,
    default: '11:00'
  },
    // NEW: 24-hour booking settings
    enable24HourBooking: {
      type: Boolean,
      default: false
    },
    // NEW: 24-hour availability settings
    availabilitySettings: {
      minBookingHours: {
        type: Number,
        default: 24
      },
      maxBookingHours: {
        type: Number,
        default: 168 // 7 days max
      },
      hostBufferTime: {
        type: Number,
        default: 2 // Hours for property preparation
      },
      allowedCheckInTimes: [{
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM']
      }],
      advanceBookingDays: {
        type: Number,
        default: 365
      }
    },

  amenities: [{
    type: String,
    enum: ['wifi', 'tv', 'kitchen', 
      'washer', 'dryer', 'ac', 'heating',
       'workspace', 'pool', 'hot-tub', 'parking',
        'gym', 'breakfast', 'smoke-alarm', 
        'carbon-monoxide-alarm', 'first-aid-kit', 
        'fire-extinguisher', 'essentials', 'fireplace' ,'security']
  }],
  features: [{
    type: String,
    enum: ['ocean-view', 'mountain-view', 'city-view', 'garden', 'balcony', 'terrace', 'fireplace', 'elevator', 'wheelchair-accessible', 'pet-friendly', 'smoking-allowed', 'long-term-stays']
  }],
  services: [{
    type: String,
    enum: ['car-rental', 'airport-pickup', 'guided-tours', 'cooking-classes', 'yoga-classes', 'massage', 'cleaning', 'laundry', 'concierge', 'breakfast', 'dinner']
  }],
  maxGuests: {
    type: Number,
    required: true,
    min: 1
  },
  minNights: {
    type: Number,
    default: 1,
    min: 1
  },
  bedrooms: {
    type: Number,
    required: true,
    min: 1
  },
  beds: {
    type: Number,
    required: true,
    min: 1
  },
  bathrooms: {
    type: Number,
    required: true,
    min: 1
  },
  cancellationPolicy: {
    type: String,
    enum: ['flexible', 'moderate', 'strict', 'super-strict'],
    default: 'moderate'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isDraft: {
    type: Boolean,
    default: true
  },
  isSponsored: {
    type: Boolean,
    default: false
  },
  isTopRated: {
    type: Boolean,
    default: false
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    slug: {
      type: String,
      unique: true
    }
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'suspended', 'deleted'],
    default: 'draft'
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: null
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  approvalReason: {
    type: String,
    maxlength: [500, 'Approval reason cannot exceed 500 characters']
  },
  rejectionReason: {
    type: String,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    cleanliness: Number,
    accuracy: Number,
    communication: Number,
    location: Number,
    checkIn: Number,
    value: Number
  },
  reviewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
propertySchema.index({ location: '2dsphere' });
propertySchema.index({ host: 1 });
propertySchema.index({ title: 'text', description: 'text' });
propertySchema.index({ 'seo.slug': 1 }, { unique: true, sparse: true });
propertySchema.index({ propertyType: 1 });
propertySchema.index({ isFeatured: 1 });
propertySchema.index({ isSponsored: 1 });
propertySchema.index({ isTopRated: 1 });
propertySchema.index({ status: 1 });
propertySchema.index({ approvalStatus: 1 });

// Virtuals
propertySchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'listing'
});

propertySchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'listing'
});

// Pre-save hook to generate slug
propertySchema.pre('save', function(next) {
  // Generate slug if title is modified or if slug is missing/null
  if (this.isModified('title') || !this.seo?.slug) {
    if (!this.seo) {
      this.seo = {};
    }
    this.seo.slug = slugify(this.title, { lower: true });
  }
  next();
});

module.exports = mongoose.model('Property', propertySchema);