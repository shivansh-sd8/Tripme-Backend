const express = require('express');
const router = express.Router();
const {
  submitKYC,
  getKYCStatus,
  updateKYC,
  getKYCRequirements,
  verifyKYC
} = require('../controllers/kyc.controller');

const { protect, adminOnly } = require('../middlewares/auth.middleware');
const AuthorizationMiddleware = require('../middlewares/authorization.middleware');

// Public routes
router.get('/requirements', getKYCRequirements);

// Protected routes
router.use(protect);

// User KYC routes
router.post('/submit', submitKYC);
router.get('/status', getKYCStatus);
router.put('/update', updateKYC);

// Admin KYC verification route
router.put('/:userId/verify', adminOnly, verifyKYC);

module.exports = router; 