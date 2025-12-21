/**
 * Verify User KYC Script
 * 
 * Usage: node scripts/verify-user-kyc.js
 * 
 * This script will verify KYC for a user by email
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Configuration
const USER_EMAIL = 'user@gmail.com';

async function verifyKYC() {
  try {
    console.log('🔐 KYC Verification Script Started');
    console.log('==================================\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error('❌ MongoDB URI not found in environment variables!');
      console.log('Please set MONGODB_URI or MONGO_URI in your .env file');
      process.exit(1);
    }

    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get models
    const User = require('../models/User');
    const KycVerification = require('../models/KycVerification');

    // Find the user
    console.log(`🔍 Looking for user: ${USER_EMAIL}`);
    const user = await User.findOne({ email: USER_EMAIL });

    if (!user) {
      console.error(`❌ User not found: ${USER_EMAIL}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`✅ User found: ${user.name || user.email}`);
    console.log(`   ID: ${user._id}`);
    console.log(`   Current KYC Status: ${user.kyc?.status || 'not_submitted'}\n`);

    // Check if user has KYC submission
    const kycDocument = await KycVerification.findOne({ user: user._id });

    if (!kycDocument) {
      console.log('⚠️  No KYC document found for this user.');
      console.log('   Creating a verified KYC record...\n');

      // Create KYC verification record with verified status
      await KycVerification.create({
        user: user._id,
        identityDocument: {
          type: 'aadhar-card',
          number: 'N/A',
          frontImage: 'N/A',
          backImage: 'N/A'
        },
        addressProof: {
          type: 'utility-bill',
          documentImage: 'N/A',
          address: user.location || {}
        },
        selfie: 'N/A',
        status: 'verified',
        verifiedAt: new Date()
      });

      // Update user's KYC status
      if (!user.kyc) {
        user.kyc = {};
      }
      user.kyc.status = 'verified';
      await user.save();

      console.log('✅ KYC verified successfully!\n');
    } else {
      console.log(`📋 KYC Document found:`);
      console.log(`   Status: ${kycDocument.status}`);
      console.log(`   Created: ${kycDocument.createdAt}\n`);

      // Update KYC status to verified
      kycDocument.status = 'verified';
      kycDocument.verifiedAt = new Date();
      kycDocument.rejectionReason = undefined; // Clear any rejection reason
      await kycDocument.save();

      // Update user's KYC status
      if (!user.kyc) {
        user.kyc = {};
      }
      user.kyc.status = 'verified';
      await user.save();

      console.log('✅ KYC verified successfully!\n');
    }

    console.log('================================');
    console.log('🎉 KYC VERIFICATION COMPLETE');
    console.log('================================');
    console.log(`📧 Email: ${USER_EMAIL}`);
    console.log(`👤 Name: ${user.name}`);
    console.log(`✅ KYC Status: verified`);
    console.log('================================\n');
    console.log('🎉 User can now become a host!');

    // Disconnect
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
verifyKYC().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

