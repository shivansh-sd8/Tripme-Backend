const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');
const { auth } = require('../middlewares/auth.middleware');
const { validateBooking } = require('../validations/booking.validation');
const AuthorizationMiddleware = require('../middlewares/authorization.middleware');
const { bookingRateLimit } = require('../middlewares/rateLimit.middleware');
const { securityMiddleware } = require('../middlewares/security.middleware');

// Protected routes (require authentication)
router.use(auth);

// Apply rate limiting to all booking routes
router.use(bookingRateLimit);

// Apply additional security measures
router.use(securityMiddleware.validateOrigin);
router.use(securityMiddleware.browserOnly);

// Booking statistics (must come before /:id routes)
router.get('/stats/overview', 
  securityMiddleware.auditLog('view_booking_stats'),
  bookingController.getBookingStats
);

// Booking CRUD operations
router.post('/', 
  securityMiddleware.auditLog('create_booking'),
  validateBooking, 
  bookingController.createBooking
);
router.get('/', 
  securityMiddleware.auditLog('view_my_bookings'),
  bookingController.getMyBookings
);
router.get('/host', 
  securityMiddleware.auditLog('view_host_bookings'),
  bookingController.getHostBookings
);

// Booking calculations and pricing
router.post('/calculate-price', 
  securityMiddleware.auditLog('calculate_booking_price'),
  bookingController.calculateBookingPrice
);

// Download receipt (must come before /:id routes)
router.get('/:id/receipt', 
  securityMiddleware.auditLog('download_booking_receipt'),
  AuthorizationMiddleware.canAccessBooking, 
  bookingController.downloadReceipt
);

// Get cancellation information (must come before /:id routes)
router.get('/:id/cancellation-info', 
  securityMiddleware.auditLog('view_cancellation_info'),
  AuthorizationMiddleware.canAccessBooking, 
  bookingController.getCancellationInfo
);

// Booking status management and CRUD with ID
router.get('/:id', 
  securityMiddleware.auditLog('view_booking_details'),
  AuthorizationMiddleware.canAccessBooking, 
  bookingController.getBookingById
);
router.put('/:id/status', 
  securityMiddleware.auditLog('update_booking_status'),
  AuthorizationMiddleware.canAccessBooking, 
  bookingController.updateBookingStatus
);
router.post('/:id/check-in', 
  securityMiddleware.auditLog('check_in_guest'),
  AuthorizationMiddleware.canAccessBooking, 
  bookingController.checkInGuest
);
router.post('/:id/cancel', 
  securityMiddleware.auditLog('cancel_booking'),
  AuthorizationMiddleware.canAccessBooking, 
  bookingController.cancelBooking
);

// Debug endpoint - REMOVED FOR PRODUCTION SECURITY
// router.get('/debug/user-context', (req, res) => { ... });

// Admin endpoint to manually release dates for a booking
router.post('/admin/:id/release-dates', 
  require('../middlewares/auth.middleware').adminOnly,
  require('../middlewares/security.middleware').auditLog('release_booking_dates'),
  bookingController.releaseBookingDates
);

module.exports = router; 