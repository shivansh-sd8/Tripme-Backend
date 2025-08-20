const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlist.controller');
const { protect } = require('../middlewares/auth.middleware');
const AuthorizationMiddleware = require('../middlewares/authorization.middleware');

// All routes require authentication
router.use(protect);

// Get user's wishlists
router.get('/', wishlistController.getMyWishlists);

// Create new wishlist
router.post('/', wishlistController.createWishlist);

// Get wishlist by ID
router.get('/:id', AuthorizationMiddleware.canAccessWishlist, wishlistController.getWishlistById);

// Update wishlist
router.put('/:id', AuthorizationMiddleware.canAccessWishlist, wishlistController.updateWishlist);

// Delete wishlist
router.delete('/:id', AuthorizationMiddleware.canAccessWishlist, wishlistController.deleteWishlist);

// Add item to wishlist
router.post('/:id/items', AuthorizationMiddleware.canAccessWishlist, wishlistController.addToWishlist);

// Remove item from wishlist
router.delete('/:id/items/:itemId', AuthorizationMiddleware.canAccessWishlist, wishlistController.removeFromWishlist);

// Share wishlist
router.post('/:id/share', AuthorizationMiddleware.canAccessWishlist, wishlistController.shareWishlist);

// Get shared wishlist (public route)
router.get('/shared/:shareId', wishlistController.getSharedWishlist);

module.exports = router; 