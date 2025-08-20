const mongoose = require('mongoose');
const Admin = require('../models/Admin');
require('dotenv').config();

const createAdmin = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: 'admin@tripme.com' });
    if (existingAdmin) {
      console.log('Admin already exists');
      process.exit(0);
    }

    // Create admin user
    const admin = await Admin.create({
      name: 'TripMe Admin',
      email: 'admin@tripme.com',
      password: 'admin123456',
      role: 'super-admin',
      permissions: [
        {
          module: 'users',
          canView: true,
          canEdit: true,
          canDelete: true
        },
        {
          module: 'properties',
          canView: true,
          canEdit: true,
          canDelete: true
        },
        {
          module: 'bookings',
          canView: true,
          canEdit: true,
          canDelete: true
        },
        {
          module: 'kyc',
          canView: true,
          canEdit: true,
          canDelete: true
        }
      ]
    });

    console.log('Admin created successfully:', {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role
    });

    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
};

createAdmin(); 