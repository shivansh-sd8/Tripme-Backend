/**

 * Razorpay Service Wrapper
 */

let razorpayInstance = null;
const Razorpay = require('razorpay');
function initializeRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.log(
      '❌ Razorpay ENV missing:',
      process.env.RAZORPAY_KEY_ID,
      process.env.RAZORPAY_KEY_SECRET
    );
    return;
  }

  if (!razorpayInstance) {
    
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    console.log('✅ Razorpay initialized successfully');
  }
}

function isInitialized() {
  return !!(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    razorpayInstance
  );
}

async function createOrder(amount, currency = 'INR', receipt, meta = {}) {
  // if (!isInitialized()) {
  //   initializeRazorpay();
  //   if (!isInitialized()) {
  //     throw new Error('Razorpay not initialized: Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
  //   }
  // }

  const amountPaise = Math.round(Number(amount) * 100);

  const orderParams = {
    amount: amountPaise,
    currency,
    receipt,
    payment_capture: 1,
    notes: meta,
  };

  const order = await razorpayInstance.orders.create(orderParams);

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    receipt: order.receipt,
    status: order.status,
    rawOrder: order,
  };
}

async function fetchPaymentStatus(paymentId) {
  if (!isInitialized()) {
    initializeRazorpay();
   
    if (!isInitialized()) throw new Error('Razorpay not initialized');
  }
  return razorpayInstance.payments.fetch(paymentId);
}

// function verifyPayment(body, signature, secret) {
//   if (!secret) throw new Error('Webhook secret required');
//   const crypto = require('crypto');
//   const expectedSignature = crypto
//     .createHmac('sha256', secret)
//     .update(body)
//     .digest('hex');
//   return expectedSignature === signature;
// }

function verifyPayment(orderId, paymentId, signature) {
    const crypto = require('crypto');
  
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  
    return generatedSignature === signature;
  }


  async function getPaymentDetails(paymentId) {
    if (!isInitialized()) {
      initializeRazorpay();
      if (!isInitialized()) {
        throw new Error('Razorpay not initialized');
      }
    }
  
    try {
      const payment = await razorpayInstance.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      console.error('❌ Error fetching Razorpay payment details:', error);
      throw error;
    }
  }

module.exports = {
  initializeRazorpay,
  isInitialized,
  createOrder,
  fetchPaymentStatus,
  verifyPayment,
  getPaymentDetails
};
