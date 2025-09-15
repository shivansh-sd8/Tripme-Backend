const mongoose = require('mongoose');
const { cleanupExpiredBlockedBookings } = require('./controllers/booking.controller');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tripme', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testCleanup() {
  try {
    console.log('🧪 ===========================================');
    console.log('🧪 TESTING CLEANUP FUNCTION');
    console.log('🧪 ===========================================');
    
    const result = await cleanupExpiredBlockedBookings();
    
    console.log('\n🎯 ===========================================');
    console.log('🎯 CLEANUP TEST COMPLETED');
    console.log('🎯 ===========================================');
    console.log(`🎯 Result: ${JSON.stringify(result, null, 2)}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testCleanup();
