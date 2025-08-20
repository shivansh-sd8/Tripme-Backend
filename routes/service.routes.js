const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/service.controller');
const { auth } = require('../middlewares/auth.middleware');
const { validateService, validateServiceUpdate } = require('../validations/service.validation');
const AuthorizationMiddleware = require('../middlewares/authorization.middleware');

// Public routes
router.get('/', serviceController.getServices);
router.get('/search', serviceController.searchServices);
router.get('/categories', serviceController.getServiceCategories);

// Protected routes (require authentication)
router.use(auth);

// Place /my-services BEFORE any parameterized routes to avoid collision
router.get('/my-services', serviceController.getMyServices);

router.get('/:id', serviceController.getService);
router.get('/:id/availability', serviceController.getServiceAvailability);
router.put('/:id/availability', AuthorizationMiddleware.isServiceProvider, serviceController.updateServiceAvailability);

// Service CRUD operations
router.post('/', validateService, serviceController.createService);
router.put('/:id', AuthorizationMiddleware.isServiceProvider, validateServiceUpdate, serviceController.updateService);
router.delete('/:id', AuthorizationMiddleware.isServiceProvider, serviceController.deleteService);

// Service availability management (granular operations - not implemented yet)
router.post('/:id/availability', AuthorizationMiddleware.isServiceProvider, serviceController.addAvailability);
router.put('/:id/availability/:availabilityId', AuthorizationMiddleware.isServiceProvider, serviceController.updateAvailability);
router.delete('/:id/availability/:availabilityId', AuthorizationMiddleware.isServiceProvider, serviceController.deleteAvailability);

// Service status and visibility
router.patch('/:id/status', AuthorizationMiddleware.isServiceProvider, serviceController.updateServiceStatus);
router.patch('/:id/visibility', AuthorizationMiddleware.isServiceProvider, serviceController.updateServiceVisibility);

// Service bookings and orders
router.get('/:id/bookings', serviceController.getServiceBookings);
router.post('/:id/book', serviceController.bookService);

// Service statistics and analytics
router.get('/stats/overview', serviceController.getServiceStats);
router.get('/stats/revenue', serviceController.getServiceRevenue);
router.get('/stats/popular', serviceController.getPopularServices);

// Service reviews and ratings
router.get('/:id/reviews', serviceController.getServiceReviews);
router.get('/:id/rating', serviceController.getServiceRating);

// Admin routes (admin only)
router.get('/admin/pending', serviceController.getPendingServices);
router.patch('/admin/:id/approve', serviceController.approveService);
router.patch('/admin/:id/reject', serviceController.rejectService);

module.exports = router; 