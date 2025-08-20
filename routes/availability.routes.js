const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availability.controller');
const { auth, optionalAuth } = require('../middlewares/auth.middleware');
const AuthorizationMiddleware = require('../middlewares/authorization.middleware');

// Public routes - Anyone can check availability
router.get('/:propertyId', optionalAuth, availabilityController.getPropertyAvailability);
router.get('/:propertyId/range', optionalAuth, availabilityController.getAvailabilityRange);

// Admin cleanup route (admin only)
router.post('/cleanup', auth, availabilityController.manualCleanup);

// Protected routes - Only authenticated users can manage availability
router.use(auth);

// Booking-related operations (any authenticated user) - These must come FIRST
router.put('/:propertyId/block-booking', availabilityController.blockDatesForBooking);
router.put('/:propertyId/confirm-booking', availabilityController.confirmBooking);
router.put('/:propertyId/release-dates', availabilityController.releaseDates);

// Host can manage their property availability
router.post('/:propertyId', AuthorizationMiddleware.isPropertyHost, availabilityController.createAvailability);
router.put('/:propertyId/:availabilityId', AuthorizationMiddleware.isPropertyHost, availabilityController.updateAvailability);
router.delete('/:propertyId/:availabilityId', AuthorizationMiddleware.isPropertyHost, availabilityController.deleteAvailability);

// Bulk operations for hosts
router.post('/:propertyId/bulk', AuthorizationMiddleware.isPropertyHost, availabilityController.bulkUpdateAvailability);
router.post('/:propertyId/block-dates', AuthorizationMiddleware.isPropertyHost, availabilityController.blockDates);
router.post('/:propertyId/unblock-dates', AuthorizationMiddleware.isPropertyHost, availabilityController.unblockDates);

module.exports = router;
