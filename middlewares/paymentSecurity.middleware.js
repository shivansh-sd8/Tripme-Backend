/**
 * Payment Security Middleware
 * Additional security measures for payment-related endpoints
 */

const { paymentRateLimit, paymentSessionManager } = require('../utils/paymentSecurity');

/**
 * Enhanced payment security middleware
 */
const paymentSecurity = (req, res, next) => {
  // Add security headers specific to payment endpoints
  res.setHeader('X-Payment-Security', 'enabled');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
};

/**
 * Validate payment request integrity
 */
const validatePaymentRequest = (req, res, next) => {
  const { paymentData, idempotencyKey } = req.body;
  
  // Validate required fields
  if (!idempotencyKey) {
    return res.status(400).json({
      success: false,
      message: 'Idempotency key is required for payment security'
    });
  }
  
  // Validate payment data structure
  if (paymentData) {
    const requiredFields = ['amount', 'currency', 'subtotal'];
    const missingFields = requiredFields.filter(field => !paymentData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment data structure',
        missingFields
      });
    }
    
    // Validate amount is positive
    if (paymentData.amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be positive'
      });
    }
    
    // Validate currency
    const validCurrencies = ['INR', 'USD', 'EUR', 'GBP'];
    if (!validCurrencies.includes(paymentData.currency)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid currency code'
      });
    }
  }
  
  next();
};

/**
 * Check for suspicious payment patterns
 */
const detectSuspiciousActivity = (req, res, next) => {
  const userId = req.user?._id;
  const ipAddress = req.ip;
  const userAgent = req.get('User-Agent');
  
  // Check for rapid successive payments
  const recentPayments = paymentSessionManager.sessions;
  const userSessions = Array.from(recentPayments.values())
    .filter(session => session.data.userId === userId);
  
  if (userSessions.length > 3) {
    console.warn('🚨 Suspicious activity detected:', {
      userId,
      ipAddress,
      userAgent,
      sessionCount: userSessions.length,
      timestamp: new Date().toISOString()
    });
    
    return res.status(429).json({
      success: false,
      message: 'Too many payment attempts detected. Please contact support.',
      code: 'SUSPICIOUS_ACTIVITY'
    });
  }
  
  // Check for unusual user agent patterns
  if (userAgent && (
    userAgent.includes('bot') || 
    userAgent.includes('crawler') ||
    userAgent.includes('scraper') ||
    userAgent.length < 10
  )) {
    console.warn('🚨 Suspicious user agent detected:', {
      userId,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString()
    });
    
    return res.status(403).json({
      success: false,
      message: 'Invalid client detected',
      code: 'INVALID_CLIENT'
    });
  }
  
  next();
};

/**
 * Payment amount validation middleware
 */
const validatePaymentAmount = (req, res, next) => {
  const { paymentData } = req.body;
  
  if (!paymentData) {
    return next(); // Skip if no payment data provided
  }
  
  // Basic amount validation
  const { amount, subtotal, platformFee, gst, processingFee, discountAmount } = paymentData;
  
  // Calculate expected total
  const expectedTotal = subtotal + platformFee + gst + processingFee - (discountAmount || 0);
  const amountDifference = Math.abs(amount - expectedTotal);
  
  if (amountDifference > 0.01) {
    return res.status(400).json({
      success: false,
      message: 'Payment amount calculation mismatch',
      expected: expectedTotal,
      provided: amount,
      difference: amountDifference
    });
  }
  
  next();
};

/**
 * Payment session validation
 */
const validatePaymentSession = (req, res, next) => {
  const { sessionId } = req.body;
  
  if (sessionId) {
    const session = paymentSessionManager.getSession(sessionId);
    
    if (!session) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired payment session'
      });
    }
    
    // Add session data to request
    req.paymentSession = session;
  }
  
  next();
};

/**
 * Audit payment attempts
 */
const auditPaymentAttempt = (req, res, next) => {
  const auditData = {
    timestamp: new Date().toISOString(),
    userId: req.user?._id,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    endpoint: req.path,
    method: req.method,
    paymentData: req.body.paymentData ? {
      amount: req.body.paymentData.amount,
      currency: req.body.paymentData.currency
    } : null,
    idempotencyKey: req.body.idempotencyKey
  };
  
  console.log('🔒 Payment Audit:', auditData);
  
  next();
};

module.exports = {
  paymentSecurity,
  validatePaymentRequest,
  detectSuspiciousActivity,
  validatePaymentAmount,
  validatePaymentSession,
  auditPaymentAttempt
};
