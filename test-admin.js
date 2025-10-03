const mongoose = require('mongoose');
const User = require('./models/User');
const Admin = require('./models/Admin');
require('dotenv').config();

// Mock request and response objects
const mockReq = {
  query: {},
  params: {},
  body: {},
  user: {
    _id: '68de4d025b15560d3e7fe855',
    email: 'shivansh.sd8@gmail.com',
    role: 'admin'
  }
};

const mockRes = {
  status: (code) => ({
    json: (data) => {
      console.log('Response Status:', code);
      console.log('Response Data:', JSON.stringify(data, null, 2));
    }
  })
};

async function testAdminController() {
  try {
    console.log('🔍 Testing admin controller...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Database connected');
    
    // Test getUsers function
    console.log('\n🔍 Testing getUsers...');
    const adminController = require('./controllers/admin.controller');
    await adminController.getUsers(mockReq, mockRes);
    
    console.log('\n✅ Test completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

testAdminController();
