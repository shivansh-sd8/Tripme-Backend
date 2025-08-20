const express = require('express');
const router = express.Router();
const {
  adminSignup,
  adminLogin,
  getDashboardStats,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  testEmail,
  getAllKYC,
  getKYCDetails,
  getPendingKYC,
  verifyKYC,
  getAllProperties,
  getPendingProperties,
  approveProperty,
  getAllBookings,
  getSystemAnalytics,
  getAdminProfile,
  updateAdminProfile,
  getAllHosts,
  approveHost,
  rejectHost,
  getAllPayments,
  processManualPayout,
  getAllReviews,
  flagReview,
  deleteReview,
  getRecentActivities,
  getSystemHealth
} = require('../controllers/admin.controller');

const { protect, adminOnly } = require('../middlewares/auth.middleware');
const {
  adminRateLimit,
  sensitiveAdminRateLimit,
  adminLoginRateLimit,
  enhancedAdminAuth,
  validateAdminInput,
  auditLog,
  requestSizeLimit,
  securityHeaders,
  ipWhitelist,
  require2FA
} = require('../middlewares/security.middleware');

// Admin signup (for initial setup only)
router.post('/signup', 
  validateAdminInput,
  requestSizeLimit,
  securityHeaders,
  auditLog('admin_signup'),
  adminSignup
);

// Admin authentication with enhanced security
router.post('/login', 
  adminLoginRateLimit,
  validateAdminInput,
  requestSizeLimit,
  securityHeaders,
  auditLog('admin_login'),
  adminLogin
);

// Protected admin routes with enhanced security
router.use(enhancedAdminAuth);
router.use(securityHeaders);
router.use(validateAdminInput);
router.use(requestSizeLimit);
router.use(adminRateLimit);

// Dashboard and analytics
router.get('/dashboard', 
  auditLog('view_dashboard'),
  getDashboardStats
);
router.get('/dashboard/stats', 
  auditLog('view_dashboard_stats'),
  getDashboardStats
);
router.get('/analytics', 
  auditLog('view_analytics'),
  getSystemAnalytics
);

// Recent activities and system health
router.get('/activities/recent', 
  auditLog('view_recent_activities'),
  getRecentActivities
);
router.get('/system/health', 
  auditLog('view_system_health'),
  getSystemHealth
);

// User management
router.get('/users', 
  auditLog('view_users'),
  getAllUsers
);
router.get('/users/:id', 
  auditLog('view_user_details'),
  getUserDetails
);
router.put('/users/:id/status', 
  sensitiveAdminRateLimit,
  auditLog('update_user_status'),
  require2FA,
  updateUserStatus
);

// KYC management
router.get('/kyc', 
  auditLog('view_kyc'),
  getAllKYC
);
router.get('/kyc/pending', 
  auditLog('view_pending_kyc'),
  getPendingKYC
);
router.get('/kyc/:userId', 
  auditLog('view_kyc_details'),
  getKYCDetails
);
router.put('/kyc/:userId/verify', 
  sensitiveAdminRateLimit,
  auditLog('verify_kyc'),
  require2FA,
  verifyKYC
);

// Property management
router.get('/properties', 
  auditLog('view_properties'),
  getAllProperties
);
router.get('/properties/pending', 
  auditLog('view_pending_properties'),
  getPendingProperties
);
router.put('/properties/:id/approve', 
  sensitiveAdminRateLimit,
  auditLog('approve_property'),
  require2FA,
  approveProperty
);

// Booking management
router.get('/bookings', 
  auditLog('view_bookings'),
  getAllBookings
);

// Host management
router.get('/hosts', 
  auditLog('view_hosts'),
  getAllHosts
);
router.put('/hosts/:id/approve', 
  sensitiveAdminRateLimit,
  auditLog('approve_host'),
  require2FA,
  approveHost
);
router.put('/hosts/:id/reject', 
  sensitiveAdminRateLimit,
  auditLog('reject_host'),
  require2FA,
  rejectHost
);

// Payment management
router.get('/payments', 
  auditLog('view_payments'),
  getAllPayments
);
router.post('/payments/:id/payout', 
  sensitiveAdminRateLimit,
  auditLog('process_manual_payout'),
  require2FA,
  processManualPayout
);

// Review management
router.get('/reviews', 
  auditLog('view_reviews'),
  getAllReviews
);
router.put('/reviews/:id/flag', 
  sensitiveAdminRateLimit,
  auditLog('flag_review'),
  require2FA,
  flagReview
);
router.delete('/reviews/:id', 
  sensitiveAdminRateLimit,
  auditLog('delete_review'),
  require2FA,
  deleteReview
);

// Admin profile
router.get('/profile', 
  auditLog('view_admin_profile'),
  getAdminProfile
);
router.put('/profile', 
  sensitiveAdminRateLimit,
  auditLog('update_admin_profile'),
  require2FA,
  updateAdminProfile
);

// Test email functionality
router.post('/test-email', 
  sensitiveAdminRateLimit,
  auditLog('test_email'),
  testEmail
);

module.exports = router; 