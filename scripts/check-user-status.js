/**
 * Check User Status Script
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const EMAIL = 'admin1@tripme.com';
const PASSWORD = 'Admin@123';

async function checkUserStatus() {
  try {
    console.log('🔍 Checking User Status');
    console.log('========================\n');

    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    
    const user = await usersCollection.findOne({ email: EMAIL });
    
    if (!user) {
      console.log('❌ User not found!');
      await mongoose.disconnect();
      return;
    }

    console.log('📋 User Details:');
    console.log('================');
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Account Status: ${user.accountStatus || 'NOT SET'}`);
    console.log(`   Is Verified: ${user.isVerified}`);
    console.log(`   Is Active: ${user.isActive}`);
    console.log('');

    // Check password
    const isPasswordValid = await bcrypt.compare(PASSWORD, user.password);
    console.log(`   Password Valid: ${isPasswordValid ? '✅ YES' : '❌ NO'}`);
    console.log('');

    // Check login requirements
    console.log('📋 Login Requirements Check:');
    console.log('============================');
    
    let canLogin = true;
    
    // 1. Password check
    if (!isPasswordValid) {
      console.log('   ❌ Password is incorrect');
      canLogin = false;
    } else {
      console.log('   ✅ Password is correct');
    }

    // 2. Account status check
    if (user.accountStatus !== 'active') {
      console.log(`   ❌ Account status is "${user.accountStatus}" (needs to be "active")`);
      canLogin = false;
    } else {
      console.log('   ✅ Account status is active');
    }

    // 3. Email verification check
    if (!user.isVerified) {
      console.log('   ❌ Email is NOT verified');
      canLogin = false;
    } else {
      console.log('   ✅ Email is verified');
    }

    console.log('');
    if (canLogin) {
      console.log('✅ User CAN login');
    } else {
      console.log('❌ User CANNOT login - fixing issues...');
      
      // Fix issues
      const updates = {};
      if (user.accountStatus !== 'active') {
        updates.accountStatus = 'active';
      }
      if (!user.isVerified) {
        updates.isVerified = true;
      }
      
      if (Object.keys(updates).length > 0) {
        await usersCollection.updateOne(
          { email: EMAIL },
          { $set: updates }
        );
        console.log('');
        console.log('🔧 Fixed issues:');
        if (updates.accountStatus) console.log('   - Set accountStatus to "active"');
        if (updates.isVerified) console.log('   - Set isVerified to true');
        console.log('');
        console.log('✅ User should now be able to login!');
      }
    }

    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
  }
}

checkUserStatus();





