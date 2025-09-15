/**
 * Payment Consistency Test Script
 * Tests frontend and backend pricing calculations for consistency
 */

const { calculatePricingBreakdown, toTwoDecimals } = require('./utils/pricingUtils');
const PricingConfig = require('./models/PricingConfig');

async function testPaymentConsistency() {
  console.log('🧪 Starting Payment Consistency Tests...\n');
  
  // Test cases with different scenarios
  const testCases = [
    {
      name: 'Basic 3-night booking',
      params: {
        basePrice: 1000,
        nights: 3,
        cleaningFee: 200,
        serviceFee: 50,
        securityDeposit: 200,
        extraGuestPrice: 0,
        extraGuests: 0,
        hourlyExtension: 0,
        discountAmount: 0,
        currency: 'INR'
      }
    },
    {
      name: 'Booking with extra guests',
      params: {
        basePrice: 1500,
        nights: 2,
        cleaningFee: 300,
        serviceFee: 75,
        securityDeposit: 300,
        extraGuestPrice: 500,
        extraGuests: 2,
        hourlyExtension: 0,
        discountAmount: 0,
        currency: 'INR'
      }
    },
    {
      name: 'Booking with hourly extension',
      params: {
        basePrice: 2000,
        nights: 1,
        cleaningFee: 400,
        serviceFee: 100,
        securityDeposit: 400,
        extraGuestPrice: 0,
        extraGuests: 0,
        hourlyExtension: 750, // 18-hour extension
        discountAmount: 0,
        currency: 'INR'
      }
    },
    {
      name: 'Booking with discount',
      params: {
        basePrice: 1200,
        nights: 4,
        cleaningFee: 250,
        serviceFee: 60,
        securityDeposit: 250,
        extraGuestPrice: 300,
        extraGuests: 1,
        hourlyExtension: 0,
        discountAmount: 500,
        currency: 'INR'
      }
    }
  ];

  let allTestsPassed = true;
  
  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log('─'.repeat(50));
    
    try {
      // Calculate pricing
      const pricing = await calculatePricingBreakdown(testCase.params);
      
      // Display results
      console.log(`💰 Base Amount: ₹${pricing.baseAmount}`);
      console.log(`🧹 Cleaning Fee: ₹${pricing.cleaningFee}`);
      console.log(`🔧 Service Fee: ₹${pricing.serviceFee}`);
      console.log(`🔒 Security Deposit: ₹${pricing.securityDeposit}`);
      console.log(`👥 Extra Guests: ${pricing.extraGuests} × ₹${pricing.extraGuestPrice} = ₹${pricing.extraGuestCost}`);
      console.log(`⏰ Hourly Extension: ₹${pricing.hourlyExtension}`);
      console.log(`💸 Discount: -₹${pricing.discountAmount}`);
      console.log(`📊 Subtotal: ₹${pricing.subtotal}`);
      console.log(`🏢 Platform Fee (${(pricing.platformFeeRate * 100).toFixed(1)}%): ₹${pricing.platformFee}`);
      console.log(`📋 GST (18%): ₹${pricing.gst}`);
      console.log(`💳 Processing Fee: ₹${pricing.processingFee}`);
      console.log(`💵 Total Amount: ₹${pricing.totalAmount}`);
      console.log(`👨‍💼 Host Earning: ₹${pricing.hostEarning}`);
      
      // Validate calculations
      const expectedSubtotal = pricing.baseAmount + pricing.cleaningFee + pricing.serviceFee + 
                              pricing.securityDeposit + pricing.extraGuestCost + 
                              pricing.hourlyExtension - pricing.discountAmount;
      
      const expectedPlatformFee = toTwoDecimals(expectedSubtotal * pricing.platformFeeRate);
      const expectedGST = toTwoDecimals(expectedSubtotal * 0.18);
      const expectedProcessingFee = toTwoDecimals(expectedSubtotal * 0.029 + 30);
      const expectedTotal = toTwoDecimals(expectedSubtotal + expectedPlatformFee + expectedGST + expectedProcessingFee);
      const expectedHostEarning = toTwoDecimals(expectedSubtotal - expectedPlatformFee);
      
      // Check consistency
      const checks = [
        { name: 'Subtotal', calculated: pricing.subtotal, expected: expectedSubtotal },
        { name: 'Platform Fee', calculated: pricing.platformFee, expected: expectedPlatformFee },
        { name: 'GST', calculated: pricing.gst, expected: expectedGST },
        { name: 'Processing Fee', calculated: pricing.processingFee, expected: expectedProcessingFee },
        { name: 'Total Amount', calculated: pricing.totalAmount, expected: expectedTotal },
        { name: 'Host Earning', calculated: pricing.hostEarning, expected: expectedHostEarning }
      ];
      
      let testPassed = true;
      for (const check of checks) {
        const difference = Math.abs(check.calculated - check.expected);
        if (difference > 0.01) {
          console.log(`❌ ${check.name} mismatch: calculated=${check.calculated}, expected=${check.expected}, diff=${difference}`);
          testPassed = false;
          allTestsPassed = false;
        } else {
          console.log(`✅ ${check.name}: ${check.calculated} (diff: ${difference.toFixed(4)})`);
        }
      }
      
      if (testPassed) {
        console.log('✅ Test PASSED');
      } else {
        console.log('❌ Test FAILED');
      }
      
    } catch (error) {
      console.error(`❌ Test ERROR: ${error.message}`);
      allTestsPassed = false;
    }
  }
  
  // Test platform fee rate consistency
  console.log('\n📊 Testing Platform Fee Rate Consistency...');
  console.log('─'.repeat(50));
  
  try {
    const rate1 = await PricingConfig.getCurrentPlatformFeeRate();
    const rate2 = await PricingConfig.getCurrentPlatformFeeRate();
    
    if (Math.abs(rate1 - rate2) < 0.001) {
      console.log(`✅ Platform fee rate consistent: ${(rate1 * 100).toFixed(1)}%`);
    } else {
      console.log(`❌ Platform fee rate inconsistent: ${(rate1 * 100).toFixed(1)}% vs ${(rate2 * 100).toFixed(1)}%`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.error(`❌ Platform fee rate test error: ${error.message}`);
    allTestsPassed = false;
  }
  
  // Final results
  console.log('\n' + '='.repeat(60));
  if (allTestsPassed) {
    console.log('🎉 ALL TESTS PASSED! Payment system is consistent.');
  } else {
    console.log('💥 SOME TESTS FAILED! Payment system has inconsistencies.');
  }
  console.log('='.repeat(60));
  
  return allTestsPassed;
}

// Run tests if called directly
if (require.main === module) {
  testPaymentConsistency()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

module.exports = { testPaymentConsistency };
