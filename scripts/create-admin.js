/**
 * Create Admin User Script
 * 
 * Creates an admin entry in the admins collection
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const ADMIN_EMAIL = 'admin1@tripme.com';
const ADMIN_PASSWORD = 'Admin@123';
const ADMIN_NAME = 'Admin User';

async function createAdmin() {
  try {
    console.log('👤 Create Admin Script');
    console.log('======================\n');

    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const adminsCollection = db.collection('admins');

    // Check if admin already exists
    const existingAdmin = await adminsCollection.findOne({ email: ADMIN_EMAIL });
    
    if (existingAdmin) {
      console.log('⚠️ Admin already exists. Updating password...');
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await adminsCollection.updateOne(
        { email: ADMIN_EMAIL },
        { $set: { password: hashedPassword, updatedAt: new Date() } }
      );
      console.log('✅ Password updated!\n');
    } else {
      console.log('📝 Creating new admin...');
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);
      
      await adminsCollection.insertOne({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        permissions: ['all'],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('✅ Admin created!\n');
    }

    console.log('================================');
    console.log('🎉 ADMIN READY');
    console.log('================================');
    console.log(`📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
    console.log('🔗 Login at: /admin/login');
    console.log('================================\n');

    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await mongoose.disconnect();
  }
}

createAdmin();
