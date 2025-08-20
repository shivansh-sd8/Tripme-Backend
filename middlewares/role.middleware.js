const roleAuth = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient privileges.'
      });
    }

    next();
  };
};

const adminAuth = roleAuth(['admin']);
const hostAuth = roleAuth(['host', 'admin']);
const guestAuth = roleAuth(['guest', 'host', 'admin']);

const verifiedUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.'
    });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Account verification required. Please verify your email address.'
    });
  }

  next();
};

const kycVerified = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (req.user.role !== 'host') {
      return res.status(403).json({
        success: false,
        message: 'Host privileges required.'
      });
    }

    const KycVerification = require('../models/KycVerification');
    const kyc = await KycVerification.findOne({ user: req.user._id });

    if (!kyc || kyc.status !== 'verified') {
      return res.status(403).json({
        success: false,
        message: 'KYC verification required to access this feature.'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'KYC verification check failed.'
    });
  }
};

module.exports = {
  roleAuth,
  adminAuth,
  hostAuth,
  guestAuth,
  verifiedUser,
  kycVerified
}; 