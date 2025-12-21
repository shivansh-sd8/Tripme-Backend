/**
 * Simple KYC Verification Script
 */

const mongoose = require('mongoose');
require('dotenv').config();

const USER_EMAIL = 'user@gmail.com';

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

    process.stdout.write(`User found: ${user.name || user.email}\n`);
    process.stdout.write(`Current KYC Status: ${user.kyc?.status || 'not_submitted'}\n`);

    let kycDoc = await KycVerification.findOne({ user: user._id });

    if (!kycDoc) {
      process.stdout.write('Creating KYC record...\n');
      kycDoc = await KycVerification.create({
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
    } else {
      process.stdout.write('Updating existing KYC record...\n');
      kycDoc.status = 'verified';
      kycDoc.verifiedAt = new Date();
      kycDoc.rejectionReason = undefined;
      await kycDoc.save();
    }

    if (!user.kyc) user.kyc = {};
    user.kyc.status = 'verified';
    await user.save();

    process.stdout.write('SUCCESS: KYC verified!\n');
    process.stdout.write(`Email: ${USER_EMAIL}\n`);
    process.stdout.write(`Status: verified\n`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    process.stdout.write(`ERROR: ${error.message}\n`);
    await mongoose.disconnect();
    process.exit(1);
  }
})();

