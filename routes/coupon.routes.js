const express = require('express');
const router = express.Router();
const couponController = require('../controllers/coupon.controller');
const { auth } = require('../middlewares/auth.middleware');
const { validateCoupon, validateCouponUpdate } = require('../validations/coupon.validation');
const AuthorizationMiddleware = require('../middlewares/authorization.middleware');

// Public routes
router.post('/validate', couponController.validateCoupon);
router.get('/public', couponController.getPublicActiveCoupons);

// Protected routes (require authentication)
router.use(auth);

// Coupon CRUD operations
router.post('/', AuthorizationMiddleware.isAdmin, validateCoupon, couponController.createCoupon);
router.get('/', couponController.getAllCoupons);
router.get('/my-coupons', couponController.getMyCoupons);
router.get('/:id', couponController.getCouponById);
router.put('/:id', AuthorizationMiddleware.isAdmin, validateCouponUpdate, couponController.updateCoupon);
router.delete('/:id', AuthorizationMiddleware.isAdmin, couponController.deleteCoupon);

// Coupon usage and tracking
router.post('/:id/use', couponController.useCoupon);
router.get('/:id/usage', AuthorizationMiddleware.isAdmin, couponController.getCouponUsage);
router.get('/:id/usage-history', AuthorizationMiddleware.isAdmin, couponController.getCouponUsageHistory);

// Coupon statistics and analytics
router.get('/stats/overview', AuthorizationMiddleware.isAdmin, couponController.getCouponStats);
router.get('/stats/popular', AuthorizationMiddleware.isAdmin, couponController.getPopularCoupons);
router.get('/stats/effectiveness', AuthorizationMiddleware.isAdmin, couponController.getCouponEffectiveness);

// Admin routes (admin only)
router.get('/admin/all', couponController.getAllCouponsAdmin);
router.get('/admin/expired', couponController.getExpiredCoupons);
router.get('/admin/active', couponController.getActiveCoupons);
router.patch('/admin/:id/status', couponController.updateCouponStatus);
router.post('/admin/bulk-create', couponController.bulkCreateCoupons);

module.exports = router; 