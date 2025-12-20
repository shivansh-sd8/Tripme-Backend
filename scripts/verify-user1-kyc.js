/**
 * Verify User1 KYC and Make Host Script
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
    process.stdout.write(`   isVerified: ${user.isVerified}\n`);
    process.stdout.write(`   accountStatus: ${user.accountStatus || 'NOT SET'}\n`);
    process.stdout.write(`   KYC Status: ${user.kyc?.status || 'not_submitted'}\n`);

    // Verify email if not verified
    if (!user.isVerified) {
      process.stdout.write(`\n⚠️  Email not verified. Verifying now...\n`);
      user.isVerified = true;
    }

    // Ensure KYC is verified
    if (!user.kyc || user.kyc.status !== 'verified') {
      process.stdout.write(`\n⚠️  KYC not verified. Verifying now...\n`);
      
      if (!user.kyc) {
        user.kyc = {};
      }
      user.kyc.status = 'verified';

      // Update or create KYC document
      let kycDoc = await KycVerification.findOne({ user: user._id });
      if (!kycDoc) {
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
        kycDoc.status = 'verified';
        kycDoc.verifiedAt = new Date();
        await kycDoc.save();
      }
    }

    // Save user
    await user.save();

    process.stdout.write(`\n✅ User updated successfully!\n`);
    process.stdout.write(`   isVerified: ${user.isVerified}\n`);
    process.stdout.write(`   KYC Status: ${user.kyc.status}\n`);
    process.stdout.write(`\n🎉 User can now become a host!\n`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    process.stdout.write(`ERROR: ${error.message}\n`);
    process.stdout.write(error.stack + '\n');
    await mongoose.disconnect();
    process.exit(1);
  }
})();



