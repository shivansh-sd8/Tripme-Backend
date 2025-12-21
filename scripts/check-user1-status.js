/**
 * Check User Status Script
 */

const mongoose = require('mongoose');
require('dotenv').config();

const USER_EMAIL = 'user1@gmail.com';

(async () => {
  try {
    process.stdout.write('Connecting to MongoDB...\n');
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    process.stdout.write('Connected!\n');

    const User = require('../models/User');
    const KycVerification = require('../models/KycVerification');

    process.stdout.write(`Finding user: ${USER_EMAIL}\n`);
    const user = await User.findOne({ email: USER_EMAIL });

    if (!user) {
      process.stdout.write(`ERROR: User not found: ${USER_EMAIL}\n`);
      await mongoose.disconnect();
      process.exit(1);
    }

    process.stdout.write(`\n✅ User Found:\n`);
    process.stdout.write(`   Name: ${user.name}\n`);
    process.stdout.write(`   Email: ${user.email}\n`);
    process.stdout.write(`   Role: ${user.role}\n`);
    process.stdout.write(`   ID: ${user._id}\n`);
    process.stdout.write(`   isVerified: ${user.isVerified}\n`);
    process.stdout.write(`   accountStatus: ${user.accountStatus || 'NOT SET'}\n`);
    process.stdout.write(`   KYC Status: ${user.kyc?.status || 'not_submitted'}\n`);

    const kycDoc = await KycVerification.findOne({ user: user._id });
    if (kycDoc) {
      process.stdout.write(`\n📋 KYC Document:\n`);
      process.stdout.write(`   Status: ${kycDoc.status}\n`);
      process.stdout.write(`   Verified At: ${kycDoc.verifiedAt || 'N/A'}\n`);
    } else {
      process.stdout.write(`\n⚠️  No KYC document found\n`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    process.stdout.write(`ERROR: ${error.message}\n`);
    await mongoose.disconnect();
    process.exit(1);
  }
})();

