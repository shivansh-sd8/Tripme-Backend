/**
 * Password Verification Script
 * 
 * This script checks if the password is correct
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const EMAIL = 'admin1@tripme.com';
const PASSWORD_TO_TEST = 'Admin@123';

async function verifyPassword() {
  try {
    console.log('🔍 Password Verification Script');
    console.log('================================\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    
    // Check users collection
    console.log('📋 Checking USERS collection...');
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ email: EMAIL });
    
    if (user) {
      console.log('✅ Found in users collection:');
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Password hash: ${user.password.substring(0, 30)}...`);
      
      // Test password
      const isMatch = await bcrypt.compare(PASSWORD_TO_TEST, user.password);
      console.log(`   Password "${PASSWORD_TO_TEST}" matches: ${isMatch ? '✅ YES' : '❌ NO'}\n`);
    } else {
      console.log('❌ Not found in users collection\n');
    }

    // Check admins collection
    console.log('📋 Checking ADMINS collection...');
    const adminsCollection = db.collection('admins');
    const admin = await adminsCollection.findOne({ email: EMAIL });
    
    if (admin) {
      console.log('✅ Found in admins collection:');
      console.log(`   Name: ${admin.name}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Role: ${admin.role}`);
      console.log(`   Password hash: ${admin.password.substring(0, 30)}...`);
      
      // Test password
      const isMatch = await bcrypt.compare(PASSWORD_TO_TEST, admin.password);
      console.log(`   Password "${PASSWORD_TO_TEST}" matches: ${isMatch ? '✅ YES' : '❌ NO'}\n`);
    } else {
      console.log('❌ Not found in admins collection\n');
    }

    // List all users with this email pattern
    console.log('📋 All users with similar email:');
    const allUsers = await usersCollection.find({ 
      email: { $regex: 'admin', $options: 'i' } 
    }).toArray();
    
    allUsers.forEach((u, i) => {
      console.log(`   ${i+1}. ${u.email} (role: ${u.role})`);
    });

    const allAdmins = await adminsCollection.find({ 
      email: { $regex: 'admin', $options: 'i' } 
    }).toArray();
    
    if (allAdmins.length > 0) {
      console.log('\n📋 All admins with similar email:');
      allAdmins.forEach((a, i) => {
        console.log(`   ${i+1}. ${a.email} (role: ${a.role})`);
      });
    }

    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
  }
}

verifyPassword();





