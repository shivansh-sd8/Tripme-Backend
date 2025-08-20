const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  city: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  locality: {
    type: String,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  country: {
    type: String,
    required: true,
    trim: true
  },
  seo: {
    title: String,
    description: String,
    keywords: [String]
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  image: String,
  propertyCount: {
    type: Number,
    default: 0
  },
  serviceCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
locationSchema.index({ coordinates: '2dsphere' });
locationSchema.index({ slug: 1 }, { unique: true });
locationSchema.index({ city: 1, state: 1, country: 1 }, { unique: true });

module.exports = mongoose.model('Location', locationSchema);