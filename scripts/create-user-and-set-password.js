/**
 * Create User and Set Password Script
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const EMAIL = 'xyz.keyur@gmail.com';
const NEW_PASSWORD = 'Keyur@123456'; // Must be at least 12 characters with uppercase, lowercase, number, and special character
const USER_NAME = 'Keyur';

async function createUserAndSetPassword() {
  try {
    console.log('🔐 Create User and Set Password Script');
    console.log('======================================\n');

    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const User = require('../models/User');
    const db = mongoose.connection.db;

    // Check if user exists
    let user = await User.findOne({ email: EMAIL });

    if (!user) {
      console.log('⚠️  User not found. Creating new user...\n');
      
      // Hash password
      const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 12);

      // Create user
      user = await User.create({
        name: USER_NAME,
        email: EMAIL,
        password: NEW_PASSWORD, // Will be hashed by pre-save hook
        role: 'guest',
        isVerified: true,
        accountStatus: 'active'
      });

      console.log('✅ User created successfully!\n');
    } else {
      console.log('📋 Found User:');
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   isVerified: ${user.isVerified}`);
      console.log(`   accountStatus: ${user.accountStatus || 'NOT SET'}\n`);

      // Hash new password
      const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 12);

      // Update user password
      await db.collection('users').updateOne(
        { email: EMAIL },
        { 
          $set: { 
            password: hashedPassword, 
            isVerified: true, 
            accountStatus: 'active'
          } 
        }
      );

      console.log('✅ Password updated successfully!\n');
    }

    console.log('================================');
    console.log('🎉 PASSWORD SET COMPLETE');
    console.log('================================');
    console.log(`   📧 Email: ${EMAIL}`);
    console.log(`   👤 Name: ${user.name}`);
    console.log(`   🔑 Password: ${NEW_PASSWORD}`);
    console.log(`   ✅ isVerified: true`);
    console.log(`   ✅ accountStatus: active`);
    console.log('================================\n');
    console.log('🎉 User can now login!');

    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createUserAndSetPassword();



