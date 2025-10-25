#!/usr/bin/env node

/**
 * Create initial pricing configuration
 * This script sets up the default pricing configuration for the platform
 */

const mongoose = require('mongoose');
const PricingConfig = require('../models/PricingConfig');
const Admin = require('../models/Admin');

async function createPricingConfig() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tripme', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('🔗 Connected to MongoDB');

    // Check if pricing config already exists
    const existingConfig = await PricingConfig.findOne({ isActive: true });
    if (existingConfig) {
      console.log('✅ Pricing configuration already exists:', {
        id: existingConfig._id,
        platformFeeRate: `${(existingConfig.platformFeeRate * 100).toFixed(1)}%`,
        effectiveFrom: existingConfig.effectiveFrom
      });
      return existingConfig;
    }

    // Find an admin user to set as creator
    const adminUser = await Admin.findOne({ role: 'admin' });
    if (!adminUser) {
      console.error('❌ No admin user found. Please create an admin user first.');
      process.exit(1);
    }

    // Create default pricing configuration
    const pricingConfig = new PricingConfig({
      platformFeeRate: 0.15, // 15% platform fee
      isActive: true,
      effectiveFrom: new Date(),
      effectiveTo: null, // No end date
      createdBy: adminUser._id,
      changeReason: 'Initial pricing configuration setup',
      version: 1
    });

    await pricingConfig.save();

    console.log('✅ Pricing configuration created successfully:', {
      id: pricingConfig._id,
      platformFeeRate: `${(pricingConfig.platformFeeRate * 100).toFixed(1)}%`,
      effectiveFrom: pricingConfig.effectiveFrom,
      createdBy: adminUser.name
    });

    return pricingConfig;
  } catch (error) {
    console.error('❌ Error creating pricing configuration:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  createPricingConfig()
    .then(() => {
      console.log('🎉 Pricing configuration setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = createPricingConfig;
