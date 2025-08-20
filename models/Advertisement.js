const mongoose = require('mongoose');

const advertisementSchema = new mongoose.Schema({
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  adType: {
    type: String,
    enum: ['sponsored', 'featured', 'banner', 'sidebar', 'boosted'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'rejected'],
    default: 'active'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  boosted: {
    type: Boolean,
    default: false
  },
  sponsored: {
    type: Boolean,
    default: false
  },
  budget: {
    type: Number,
    required: true
  },
  spent: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },
  impressions: {
    type: Number,
    default: 0
  },
  targetLocations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  }],
  targetAudience: {
    countries: [String],
    languages: [String],
    interests: [String]
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  creative: {
    imageUrl: String,
    headline: String,
    description: String,
    callToAction: String
  },
  performance: {
    ctr: {
      type: Number,
      default: 0
    },
    cpc: {
      type: Number,
      default: 0
    },
    cpm: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
advertisementSchema.index({ listing: 1 });
advertisementSchema.index({ service: 1 });
advertisementSchema.index({ adType: 1 });
advertisementSchema.index({ status: 1 });
advertisementSchema.index({ startDate: 1 });
advertisementSchema.index({ endDate: 1 });
advertisementSchema.index({ boosted: 1 });
advertisementSchema.index({ sponsored: 1 });
advertisementSchema.index({ priority: -1 });

// Pre-save hook to calculate performance metrics
advertisementSchema.pre('save', function(next) {
  if (this.impressions > 0) {
    this.performance.ctr = (this.clicks / this.impressions) * 100;
  }
  if (this.clicks > 0) {
    this.performance.cpc = this.spent / this.clicks;
  }
  if (this.impressions > 0) {
    this.performance.cpm = (this.spent / this.impressions) * 1000;
  }
  next();
});

// Static method to get active advertisements sorted by priority
advertisementSchema.statics.getActiveAds = function() {
  return this.find({
    status: 'active',
    startDate: { $lte: new Date() },
    endDate: { $gte: new Date() }
  }).sort({ priority: -1, boosted: -1, sponsored: -1 });
};

module.exports = mongoose.model('Advertisement', advertisementSchema);