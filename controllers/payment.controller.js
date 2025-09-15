const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const Refund = require('../models/Refund');
const Notification = require('../models/Notification');
const PaymentService = require('../services/payment.service');
const { 
  verifyPaymentAmount, 
  validateBookingParameters,
  paymentRateLimit,
  paymentSessionManager,
  generateIdempotencyKey,
  verifyWebhookSignature
} = require('../utils/paymentSecurity');

// @desc    Process payment (enhanced with fee calculation)
// @route   POST /api/payments/process
// @access  Private
const processPayment = async (req, res) => {
  try {
    const { bookingId, paymentMethod, couponCode, ipAddress, userAgent, paymentData, idempotencyKey } = req.body;
    
    // Rate limiting check
    if (!paymentRateLimit.isAllowed(req.user._id)) {
      const remainingAttempts = paymentRateLimit.getRemainingAttempts(req.user._id);
      return res.status(429).json({ 
        success: false, 
        message: 'Too many payment attempts. Please try again later.',
        remainingAttempts,
        retryAfter: 15 * 60 // 15 minutes in seconds
      });
    }
    
    // Validate idempotency key
    if (!idempotencyKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Idempotency key is required for payment processing' 
      });
    }
    
    // Check for duplicate payment with same idempotency key
    const existingPayment = await Payment.findOne({ 
      'metadata.idempotencyKey': idempotencyKey,
      user: req.user._id
    });
    
    if (existingPayment) {
      return res.status(409).json({ 
        success: false, 
        message: 'Payment with this idempotency key already exists',
        paymentId: existingPayment._id
      });
    }
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    // Verify user owns the booking
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to pay for this booking' 
      });
    }
    
    // Validate booking parameters for security
    const bookingValidation = validateBookingParameters({
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guests: booking.guests,
      basePrice: booking.listing?.pricing?.basePrice || booking.service?.pricing?.basePrice,
      hourlyExtension: booking.hourlyExtension
    });
    
    if (!bookingValidation.isValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid booking parameters',
        errors: bookingValidation.errors
      });
    }
    
    // Verify payment amount if provided
    if (paymentData) {
      const amountVerification = verifyPaymentAmount(paymentData, {
        basePrice: booking.listing?.pricing?.basePrice || booking.service?.pricing?.basePrice || 0,
        nights: booking.bookingDuration === 'daily' ? 
          Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)) : 1,
        cleaningFee: booking.cleaningFee || 0,
        serviceFee: booking.serviceFee || 0,
        securityDeposit: booking.securityDeposit || 0,
        extraGuestPrice: booking.listing?.pricing?.extraGuestPrice || booking.service?.pricing?.perPersonPrice || 0,
        extraGuests: booking.guests?.adults > 1 ? booking.guests.adults - 1 : 0,
        hourlyExtension: booking.hourlyExtension?.cost || 0,
        discountAmount: booking.discountAmount || 0,
        currency: booking.currency || 'INR'
      });
      
      if (!amountVerification.isValid) {
        return res.status(400).json({ 
          success: false, 
          message: 'Payment amount verification failed',
          errors: amountVerification.errors,
          expectedAmount: amountVerification.expectedAmount,
          actualAmount: amountVerification.actualAmount
        });
      }
    }
    
    // Check if payment already exists for this booking
    const existingBookingPayment = await Payment.findOne({ booking: bookingId });
    if (existingBookingPayment) {
      return res.status(400).json({ 
        success: false, 
        message: 'Payment already exists for this booking',
        paymentId: existingBookingPayment._id,
        status: existingBookingPayment.status
      });
    }
    
    // Create payment session for tracking
    const sessionId = paymentSessionManager.createSession({
      bookingId,
      userId: req.user._id,
      paymentMethod,
      amount: booking.totalAmount,
      currency: booking.currency
    });
    
    // Apply coupon if provided
    let coupon = null;
    if (couponCode) {
      coupon = await Coupon.findOne({ 
        code: couponCode.toUpperCase(), 
        isActive: true, 
        validFrom: { $lte: new Date() }, 
        validTo: { $gte: new Date() } 
      });
      
      if (coupon) {
        const hasUsed = coupon.usedBy.some(usage => usage.user.toString() === req.user.id);
        if (!hasUsed) {
        if (coupon.discountType === 'percentage') {
          // Apply discount to subtotal, not total amount
          const discount = (booking.subtotal * coupon.amount) / 100;
          const maxDiscount = coupon.maxDiscount || discount;
          booking.discountAmount = Math.min(discount, maxDiscount);
        } else {
          booking.discountAmount = coupon.amount;
        }
          booking.couponApplied = coupon._id;
          coupon.usedCount += 1;
          coupon.usedBy.push({ user: req.user.id, usedAt: new Date() });
          await coupon.save();
        }
      }
    }
    
    // Process payment using PaymentService with enhanced security
    const paymentServiceData = {
      paymentMethod,
      transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      gateway: 'mock', // TODO: Integrate with actual payment gateway
      gatewayResponse: { status: 'success' },
      ipAddress: ipAddress || req.ip,
      userAgent: userAgent || req.get('User-Agent'),
      source: 'web',
      sessionId,
      idempotencyKey,
      securityMetadata: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        forwardedFor: req.get('X-Forwarded-For'),
        realIp: req.get('X-Real-IP'),
        referer: req.get('Referer'),
        origin: req.get('Origin'),
        timestamp: new Date().toISOString()
      }
    };
    
    const { payment, feeBreakdown } = await PaymentService.processPayment(bookingId, paymentServiceData, req.user);
    
    // Update booking status to confirmed after successful payment
    booking.status = 'confirmed';
    booking.paymentStatus = 'paid';
    await booking.save();
    console.log(`✅ Booking ${bookingId} confirmed after payment processing`);
    
    // Update availability status to 'booked' after successful payment
    try {
      const { updateAvailabilityStatus } = require('./availability.controller');
      await updateAvailabilityStatus(booking._id, 'booked');
    } catch (availabilityError) {
      console.error('Error updating availability status:', availabilityError);
      // Don't fail the payment if availability update fails
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Payment processed successfully', 
      data: { 
        payment,
        feeBreakdown,
        message: `Payment of ₹${payment.amount} processed successfully. Host will receive ₹${feeBreakdown.hostEarning} after 24 hours.`
      } 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error processing payment', 
      error: error.message 
    });
  }
};

// @desc    Confirm payment (mock)
// @route   POST /api/payments/confirm/:paymentId
// @access  Private
const confirmPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    
    if (payment.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    // TODO: Verify payment with payment gateway
    // For now, just confirm the payment
    payment.status = 'completed';
    await payment.save();
    
    // Update booking status to confirmed
    if (payment.booking) {
      const Booking = require('../models/Booking');
      await Booking.findByIdAndUpdate(payment.booking, {
        status: 'confirmed',
        paymentStatus: 'paid'
      });
      console.log(`✅ Booking ${payment.booking} confirmed after payment`);
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Payment confirmed successfully' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error confirming payment', 
      error: error.message 
    });
  }
};

// @desc    Cancel payment (mock)
// @route   POST /api/payments/cancel/:paymentId
// @access  Private
const cancelPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    
    if (payment.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    payment.status = 'cancelled';
    await payment.save();
    
    res.status(200).json({ 
      success: true, 
      message: 'Payment cancelled successfully' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error cancelling payment', 
      error: error.message 
    });
  }
};

// @desc    Get payment by ID with enhanced details
// @route   GET /api/payments/:id
// @access  Private
const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findById(id)
      .populate('booking', 'totalAmount currency checkIn checkOut receiptId')
      .populate('user', 'name email')
      .populate('host', 'name email')
      .populate('coupon', 'code discountType amount');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check authorization
    if (payment.user.toString() !== req.user.id && 
        payment.host.toString() !== req.user.id && 
        req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this payment'
      });
    }

    // Get payout information if user is host
    let payoutInfo = null;
    if (payment.host.toString() === req.user.id) {
      payoutInfo = await Payout.findOne({ payment: payment._id })
        .select('status scheduledDate processedDate amount method');
    }

    // Get refund information
    const refunds = await Refund.find({ payment: payment._id })
      .select('amount reason type status processedAt refundReference');

    res.status(200).json({
      success: true,
      data: { 
        payment,
        payoutInfo,
        refunds,
        feeBreakdown: {
          subtotal: payment.subtotal,
          taxes: payment.taxes,
          cleaningFee: payment.cleaningFee,
          securityDeposit: payment.securityDeposit,
          platformFee: payment.commission.platformFee,
          hostEarning: payment.commission.hostEarning,
          totalAmount: payment.amount
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching payment',
      error: error.message
    });
  }
};

// @desc    Get user's payment history with enhanced details
// @route   GET /api/payments/history
// @access  Private
const getPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = { user: req.user.id };
    if (status) {
      query.status = status;
    }

    const payments = await Payment.find(query)
      .populate('booking', 'totalAmount currency checkIn checkOut receiptId')
      .populate('host', 'name')
      .populate('coupon', 'code discountType amount')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Payment.countDocuments(query);

    // Enhance payment data with additional information
    const enhancedPayments = await Promise.all(payments.map(async (payment) => {
      const refunds = await Refund.find({ payment: payment._id })
        .select('amount status processedAt');
      
      return {
        ...payment.toObject(),
        totalRefunded: payment.totalRefunded,
        netAmount: payment.netAmount,
        refunds
      };
    }));

    res.status(200).json({
      success: true,
      data: {
        payments: enhancedPayments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching payment history',
      error: error.message
    });
  }
};

// @desc    Get host's payment and payout information
// @route   GET /api/payments/host
// @access  Private (Host only)
const getHostPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    // Verify user is a host
    if (req.user.role !== 'host' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only hosts can access this endpoint'
      });
    }

    const query = { host: req.user.id };
    if (status) {
      query.status = status;
    }

    const payments = await Payment.find(query)
      .populate('booking', 'totalAmount currency checkIn checkOut receiptId')
      .populate('user', 'name email')
      .populate('coupon', 'code discountType amount')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Payment.countDocuments(query);

    // Get payout information for each payment
    const enhancedPayments = await Promise.all(payments.map(async (payment) => {
      const payout = await Payout.findOne({ payment: payment._id })
        .select('status scheduledDate processedDate amount method');
      
      return {
        ...payment.toObject(),
        payout,
        hostEarning: payment.commission.hostEarning,
        platformFee: payment.commission.platformFee
      };
    }));

    // Get host payout statistics
    const payoutStats = await PaymentService.getHostPayoutStats(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        payments: enhancedPayments,
        payoutStats,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching host payments',
      error: error.message
    });
  }
};

// @desc    Get payments for a specific booking
// @route   GET /api/payments/booking/:bookingId
// @access  Private
const getBookingPayments = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    if (booking.user.toString() !== req.user.id && booking.host.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    const payments = await Payment.find({ booking: bookingId })
      .populate('user', 'name email')
      .populate('coupon', 'code discountType amount')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      data: { payments }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching booking payments',
      error: error.message
    });
  }
};

// @desc    Process refund with enhanced logic
// @route   POST /api/payments/:paymentId/refund
// @access  Private
const processRefund = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount, reason, type, userNotes } = req.body;
    
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    
    if (payment.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Can only refund completed payments' });
    }
    
    if (payment.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to refund this payment' });
    }
    
    if (amount > payment.amount) {
      return res.status(400).json({ success: false, message: 'Refund amount cannot exceed payment amount' });
    }
    
    // Process refund using PaymentService
    const refundData = {
      amount,
      reason,
      type,
      userNotes,
      adminNotes: req.user.role === 'admin' ? req.body.adminNotes : null
    };
    
    const refund = await PaymentService.processRefund(paymentId, refundData, req.user.role === 'admin' ? req.user : null);
    
    res.status(200).json({ 
      success: true, 
      message: 'Refund processed successfully', 
      data: { 
        refund,
        message: `Refund of ₹${amount} has been processed. It will be credited to your original payment method within 3-5 business days.`
      } 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error processing refund', 
      error: error.message 
    });
  }
};

// @desc    Get refund history with enhanced details
// @route   GET /api/payments/refunds
// @access  Private
const getRefundHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const refunds = await Refund.find({ user: req.user.id })
      .populate('payment', 'amount paymentMethod')
      .populate('booking', 'totalAmount currency')
      .populate('host', 'name')
      .sort({ processedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Refund.countDocuments({ user: req.user.id });
    
    res.status(200).json({
      success: true,
      data: {
        refunds,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching refund history',
      error: error.message
    });
  }
};

// @desc    Get refund by ID
// @route   GET /api/payments/refunds/:refundId
// @access  Private
const getRefundById = async (req, res) => {
  try {
    const { refundId } = req.params;
    
    const refund = await Refund.findById(refundId)
      .populate('payment', 'amount paymentMethod')
      .populate('booking', 'totalAmount currency')
      .populate('user', 'name email');
    
    if (!refund) {
      return res.status(404).json({ success: false, message: 'Refund not found' });
    }
    
    if (refund.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    res.status(200).json({
      success: true,
      data: { refund }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching refund',
      error: error.message
    });
  }
};

// @desc    Get payment methods
// @route   GET /api/payments/methods
// @access  Private
const getPaymentMethods = async (req, res) => {
  try {
    const mockMethods = [
      {
        id: 'method_1',
        type: 'card',
        last4: '1234',
        brand: 'Visa',
        isDefault: true
      },
      {
        id: 'method_2',
        type: 'upi',
        upiId: 'user@upi',
        isDefault: false
      }
    ];
    
    res.status(200).json({
      success: true,
      data: { paymentMethods: mockMethods }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching payment methods',
      error: error.message
    });
  }
};

// @desc    Add payment method
// @route   POST /api/payments/methods
// @access  Private
const addPaymentMethod = async (req, res) => {
  try {
    const { type, details, isDefault } = req.body;
    
    res.status(201).json({
      success: true,
      message: 'Payment method added successfully',
      data: { 
        id: `method_${Date.now()}`,
        type,
        isDefault: isDefault || false
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding payment method',
      error: error.message
    });
  }
};

// @desc    Update payment method
// @route   PUT /api/payments/methods/:methodId
// @access  Private
const updatePaymentMethod = async (req, res) => {
  try {
    const { methodId } = req.params;
    const { details } = req.body;
    
    res.status(200).json({
      success: true,
      message: 'Payment method updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating payment method',
      error: error.message
    });
  }
};

// @desc    Delete payment method
// @route   DELETE /api/payments/methods/:methodId
// @access  Private
const deletePaymentMethod = async (req, res) => {
  try {
    const { methodId } = req.params;
    
    res.status(200).json({
      success: true,
      message: 'Payment method deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting payment method',
      error: error.message
    });
  }
};

// @desc    Set default payment method
// @route   POST /api/payments/methods/:methodId/set-default
// @access  Private
const setDefaultPaymentMethod = async (req, res) => {
  try {
    const { methodId } = req.params;
    
    res.status(200).json({
      success: true,
      message: 'Default payment method updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error setting default payment method',
      error: error.message
    });
  }
};

// @desc    Payment webhooks (enhanced security)
// @route   POST /api/payments/webhook/stripe
// @access  Public
const stripeWebhook = async (req, res) => {
  try {
    const signature = req.get('stripe-signature');
    const payload = JSON.stringify(req.body);
    
    // Verify webhook signature (when real Stripe is integrated)
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      const isValidSignature = verifyWebhookSignature(
        payload, 
        signature, 
        process.env.STRIPE_WEBHOOK_SECRET
      );
      
      if (!isValidSignature) {
        console.error('❌ Invalid webhook signature');
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid webhook signature' 
        });
      }
    }
    
    // Log webhook for security audit
    console.log('🔒 Webhook received:', {
      timestamp: new Date().toISOString(),
      signature: signature ? 'present' : 'missing',
      payload: req.body,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // Process webhook based on event type
    const event = req.body;
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handleWebhookPaymentFailure(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing webhook',
      error: error.message
    });
  }
};

// Handle successful payment
const handlePaymentSuccess = async (paymentIntent) => {
  try {
    const payment = await Payment.findOne({ 
      'paymentDetails.transactionId': paymentIntent.id 
    });
    
    if (payment) {
      payment.status = 'completed';
      payment.processedAt = new Date();
      payment.paymentDetails.gatewayResponse = paymentIntent;
      await payment.save();
      
      // Update booking status
      const booking = await Booking.findById(payment.booking);
      if (booking) {
        booking.paymentStatus = 'paid';
        booking.status = 'confirmed';
        await booking.save();
      }
      
      console.log('✅ Payment confirmed:', payment._id);
    }
  } catch (error) {
    console.error('❌ Error handling payment success:', error);
  }
};

// Handle failed payment (webhook helper)
const handleWebhookPaymentFailure = async (paymentIntent) => {
  try {
    const payment = await Payment.findOne({ 
      'paymentDetails.transactionId': paymentIntent.id 
    });
    
    if (payment) {
      payment.status = 'failed';
      payment.paymentDetails.gatewayResponse = paymentIntent;
      await payment.save();
      
      // Update booking status
      const booking = await Booking.findById(payment.booking);
      if (booking) {
        booking.paymentStatus = 'failed';
        booking.status = 'cancelled';
        await booking.save();
      }
      
      console.log('❌ Payment failed:', payment._id);
    }
  } catch (error) {
    console.error('❌ Error handling payment failure:', error);
  }
};

// @desc    PayPal webhook (mock)
// @route   POST /api/payments/webhook/paypal
// @access  Public
const paypalWebhook = async (req, res) => {
  try {
    res.status(200).json({ received: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing webhook',
      error: error.message
    });
  }
};

// @desc    Get payment statistics with enhanced data
// @route   GET /api/payments/stats/overview
// @access  Private
const getPaymentStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const totalPayments = await Payment.countDocuments({ user: userId });
    const completedPayments = await Payment.countDocuments({ user: userId, status: 'completed' });
    const totalAmount = await Payment.aggregate([
      { $match: { user: userId, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    const totalRefunds = await Refund.countDocuments({ user: userId });
    const refundAmount = await Refund.aggregate([
      { $match: { user: userId, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    // Get monthly payment trends
    const monthlyTrends = await Payment.aggregate([
      { $match: { user: userId, status: 'completed' } },
      {
        $group: {
          _id: { 
            year: { $year: '$createdAt' }, 
            month: { $month: '$createdAt' } 
          },
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        totalPayments,
        completedPayments,
        totalAmount: totalAmount[0]?.total || 0,
        totalRefunds,
        refundAmount: refundAmount[0]?.total || 0,
        netSpent: (totalAmount[0]?.total || 0) - (refundAmount[0]?.total || 0),
        monthlyTrends
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching payment statistics',
      error: error.message
    });
  }
};

// @desc    Get monthly payment statistics
// @route   GET /api/payments/stats/monthly
// @access  Private
const getMonthlyPaymentStats = async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const userId = req.user.id;
    
    const monthlyStats = await Payment.aggregate([
      { $match: { user: userId, status: 'completed' } },
      {
        $group: {
          _id: { $month: '$createdAt' },
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.status(200).json({
      success: true,
      data: { monthlyStats }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly payment statistics',
      error: error.message
    });
  }
};

// @desc    Get payment method statistics
// @route   GET /api/payments/stats/methods
// @access  Private
const getPaymentMethodStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const methodStats = await Payment.aggregate([
      { $match: { user: userId, status: 'completed' } },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      data: { methodStats }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching payment method statistics',
      error: error.message
    });
  }
};

// @desc    Get all payments for admin with enhanced details
// @route   GET /api/payments/admin/all
// @access  Private/Admin
const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { 'paymentDetails.transactionId': { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } },
        { 'host.name': { $regex: search, $options: 'i' } }
      ];
    }
    
    const payments = await Payment.find(query)
      .populate('user', 'name email')
      .populate('host', 'name email')
      .populate('booking', 'totalAmount currency checkIn checkOut receiptId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Payment.countDocuments(query);
    
    // Enhance payments with payout and refund information
    const enhancedPayments = await Promise.all(payments.map(async (payment) => {
      const payout = await Payout.findOne({ payment: payment._id })
        .select('status scheduledDate processedDate amount method');
      
      const refunds = await Refund.find({ payment: payment._id })
        .select('amount status reason type');
      
      return {
        ...payment.toObject(),
        payout,
        refunds,
        totalRefunded: payment.totalRefunded,
        netAmount: payment.netAmount,
        payoutAmount: payment.payoutAmount
      };
    }));
    
    res.status(200).json({
      success: true,
      data: {
        payments: enhancedPayments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching all payments',
      error: error.message
    });
  }
};

// @desc    Get pending payouts for admin
// @route   GET /api/payments/admin/payouts
// @access  Private/Admin
const getPendingPayouts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const payouts = await Payout.find({ status: 'pending' })
      .populate('host', 'name email')
      .populate('payment', 'amount')
      .populate('booking', 'totalAmount currency')
      .sort({ scheduledDate: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Payout.countDocuments({ status: 'pending' });
    
    res.status(200).json({
      success: true,
      data: {
        payouts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pending payouts',
      error: error.message
    });
  }
};

// @desc    Process host payout (admin)
// @route   POST /api/payments/admin/payouts/:payoutId/process
// @access  Private/Admin
const processHostPayout = async (req, res) => {
  try {
    const { payoutId } = req.params;
    const payoutData = req.body;
    
    const payout = await PaymentService.processHostPayout(payoutId, payoutData, req.user);
    
    res.status(200).json({
      success: true,
      message: 'Payout processing initiated successfully',
      data: { payout }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing payout',
      error: error.message
    });
  }
};

// @desc    Get payment statistics for admin
// @route   GET /api/payments/admin/stats
// @access  Private/Admin
const getAdminPaymentStats = async (req, res) => {
  try {
    const stats = await PaymentService.getAdminPaymentStats();
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching payment statistics',
      error: error.message
    });
  }
};

// @desc    Update payment status (admin)
// @route   PATCH /api/payments/admin/:paymentId/status
// @access  Private/Admin
const updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status } = req.body;
    
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    
    payment.status = status;
    await payment.save();
    
    // If payment is marked as failed, revert availability to 'available'
    if (status === 'failed' && payment.booking) {
      try {
        const { updateAvailabilityStatus } = require('./availability.controller');
        await updateAvailabilityStatus(payment.booking, 'available');
      } catch (availabilityError) {
        console.error('Error reverting availability status:', availabilityError);
        // Don't fail the status update if availability update fails
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating payment status',
      error: error.message
    });
  }
};

// @desc    Handle payment failure and revert availability
// @route   POST /api/payments/:paymentId/fail
// @access  Private
const handlePaymentFailure = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }
    
    if (payment.user.toString() !== req.user._id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    
    // Mark payment as failed
    payment.status = 'failed';
    await payment.save();
    
    // Update booking status
    if (payment.booking) {
      const booking = await Booking.findById(payment.booking);
      if (booking) {
        booking.paymentStatus = 'failed';
        booking.status = 'cancelled';
        await booking.save();
      }
    }
    
    // Revert availability to 'available'
    if (payment.booking) {
      try {
        const { updateAvailabilityStatus } = require('./availability.controller');
        await updateAvailabilityStatus(payment.booking, 'available');
      } catch (availabilityError) {
        console.error('Error reverting availability status:', availabilityError);
        // Don't fail the payment failure handling if availability update fails
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Payment failure handled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error handling payment failure',
      error: error.message
    });
  }
};

module.exports = {
  processPayment,
  confirmPayment,
  cancelPayment,
  getPaymentById,
  getPaymentHistory,
  getHostPayments,
  getBookingPayments,
  processRefund,
  getRefundHistory,
  getRefundById,
  getPaymentMethods,
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  stripeWebhook,
  paypalWebhook,
  getPaymentStats,
  getMonthlyPaymentStats,
  getPaymentMethodStats,
  getAllPayments,
  getPendingPayouts,
  processHostPayout,
  getAdminPaymentStats,
  updatePaymentStatus,
  handlePaymentFailure
}; 