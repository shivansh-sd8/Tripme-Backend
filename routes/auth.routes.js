const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { auth } = require('../middlewares/auth.middleware');
const { validateRegistration, validateLogin, validatePasswordReset } = require('../validations/auth.validation');

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes working' });
});

// Debug route for Google login
router.post('/google-debug', (req, res) => {
  console.log('Google debug endpoint hit');
  console.log('Request body:', req.body);
  console.log('Request headers:', req.headers);
  res.json({ 
    message: 'Google debug endpoint working',
    body: req.body,
    headers: req.headers
  });
});

// Public routes
router.post('/register', validateRegistration, authController.registerUser);
router.post('/login', validateLogin, authController.loginUser);
// Sends link to reset password
router.post('/forgot-password', authController.forgotPassword);
// Check the validity of the reset token
router.get('/reset-password/:token', authController.validateResetToken);
// Reset password
router.post('/reset-password/:token', validatePasswordReset, authController.resetPassword);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerificationEmail);

// Social authentication
router.post('/google', authController.socialLogin);
router.post('/facebook', authController.socialLogin);
router.post('/apple', authController.socialLogin);

// Protected routes (require authentication)
router.use(auth);

// User session management
router.get('/me', authController.getCurrentUser);
router.put('/profile', authController.updateProfile);
router.put('/password', authController.changePassword);
router.post('/logout', authController.logoutUser);
router.post('/logout-all', authController.logoutAllDevices);

// Account management
router.delete('/account', authController.deleteAccount);
router.post('/deactivate', authController.deactivateAccount);
router.post('/reactivate', authController.reactivateAccount);

// Two-factor authentication
router.post('/2fa/enable', authController.enable2FA);
router.post('/2fa/disable', authController.disable2FA);
router.post('/2fa/verify', authController.verify2FA);

// Session management
router.get('/sessions', authController.getActiveSessions);
router.delete('/sessions/:sessionId', authController.terminateSession);

module.exports = router;
