/**
 * Password Reset Script for Admin User
 * 
 * Usage: node scripts/reset-admin-password.js
 * 
 * This script will reset the password for admin1@tripme.com
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Configuration
const ADMIN_EMAIL = 'admin1@tripme.com';
const NEW_PASSWORD = 'Admin@123'; // Change this to your desired password

async function resetPassword() {
  try {
    console.log('🔐 Password Reset Script Started');
    console.log('================================\n');

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

    // Get the users collection
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Find the user
    console.log(`🔍 Looking for user: ${ADMIN_EMAIL}`);
    const user = await usersCollection.findOne({ email: ADMIN_EMAIL });

    if (!user) {
      console.error(`❌ User not found: ${ADMIN_EMAIL}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`✅ User found: ${user.name || user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   ID: ${user._id}\n`);

    // Generate new password hash
    console.log('🔒 Generating new password hash...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, saltRounds);
    console.log('✅ New hash generated\n');

    // Update the password
    console.log('📝 Updating password in database...');
    const result = await usersCollection.updateOne(
      { email: ADMIN_EMAIL },
      { 
        $set: { 
          password: hashedPassword,
          updatedAt: new Date()
        } 
      }
    );

    if (result.modifiedCount === 1) {
      console.log('✅ Password updated successfully!\n');
      console.log('================================');
      console.log('🎉 PASSWORD RESET COMPLETE');
      console.log('================================');
      console.log(`📧 Email: ${ADMIN_EMAIL}`);
      console.log(`🔑 New Password: ${NEW_PASSWORD}`);
      console.log('================================\n');
    } else {
      console.error('❌ Failed to update password');
    }

    // Disconnect
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the script
resetPassword();

