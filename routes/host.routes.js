
const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');
const AuthorizationMiddleware = require('../middlewares/authorization.middleware');

// Protected routes (require authentication)
router.use(protect);

// Become host
router.post('/become', userController.becomeHost);

// Host profile endpoints
router.put('/profile', userController.updateUserProfile);
router.post('/profile/image', (req, res) => {
  // TODO: Implement image upload
  res.status(501).json({ success: false, message: 'Image upload not implemented yet' });
});

module.exports = router; 