const PricingConfig = require('../models/PricingConfig');
const User = require('../models/User');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const PaymentAuditLog = require('../models/PaymentAuditLog');

// Dashboard Stats
const getDashboardStats = async (req, res) => {
  try {
    // Get user stats
    const totalUsers = await User.countDocuments();
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    });
    const totalHosts = await User.countDocuments({ role: 'host' });
    const pendingKYC = await User.countDocuments({ 
      role: 'host', 
      'kyc.status': { $in: ['pending', 'submitted'] } 
    });

    // Get property stats
    const totalProperties = await Property.countDocuments();
    const activeProperties = await Property.countDocuments({ status: 'active' });
    const pendingProperties = await Property.countDocuments({ status: 'pending' });

    // Get booking stats
    const totalBookings = await Booking.countDocuments();
    const completedBookings = await Booking.countDocuments({ status: 'completed' });
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });

    // Get revenue stats
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          newThisMonth: newUsersThisMonth,
          pendingKYC,
          totalHosts
        },
        properties: {
          total: totalProperties,
          active: activeProperties,
          pending: pendingProperties
        },
        bookings: {
          total: totalBookings,
          completed: completedBookings,
          pending: pendingBookings
        },
        revenue: {
          total: totalRevenue[0]?.total || 0,
          thisMonth: monthlyRevenue[0]?.total || 0
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
      error: error.message
    });
  }
};

// Platform Fee Management
const getCurrentPlatformFeeRate = async (req, res) => {
  try {
    const currentRate = await PricingConfig.getCurrentPlatformFeeRate();

    res.status(200).json({
      success: true,
      data: {
        platformFeeRate: currentRate,
        platformFeePercentage: (currentRate * 100).toFixed(1),
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('❌ Error fetching platform fee rate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform fee rate',
      error: error.message
    });
  }
};

const updatePlatformFeeRate = async (req, res) => {
  try {
    const { platformFeeRate, changeReason } = req.body;
    
    if (!platformFeeRate || typeof platformFeeRate !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Platform fee rate is required and must be a number'
      });
    }
    
    if (platformFeeRate < 0 || platformFeeRate > 1) {
      return res.status(400).json({
      success: false,
        message: 'Platform fee rate must be between 0 and 1 (0-100%)'
      });
    }
    
    const currentRate = await PricingConfig.getCurrentPlatformFeeRate();
    
    if (Math.abs(currentRate - platformFeeRate) < 0.001) {
      return res.status(400).json({
        success: false,
        message: 'New platform fee rate is the same as current rate'
      });
    }
    
    const newConfig = await PricingConfig.updatePlatformFeeRate(
      platformFeeRate,
      req.user._id,
      changeReason || 'Platform fee rate updated via admin panel'
    );
    
    const adminName = req.user?.name || req.user?.email || 'Unknown Admin';
    console.log(`✅ Platform fee rate updated from ${(currentRate * 100).toFixed(1)}% to ${(platformFeeRate * 100).toFixed(1)}% by admin ${adminName}`);

    res.status(200).json({
      success: true,
      message: 'Platform fee rate updated successfully',
      data: {
        previousRate: currentRate,
        newRate: platformFeeRate,
        previousPercentage: (currentRate * 100).toFixed(1),
        newPercentage: (platformFeeRate * 100).toFixed(1),
        changeReason: changeReason,
        updatedBy: adminName,
        updatedAt: newConfig.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Error updating platform fee rate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update platform fee rate',
      error: error.message
    });
  }
};

const getPlatformFeeHistory = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const history = await PricingConfig.getPricingHistory(parseInt(limit));
    
    const formattedHistory = history.map(config => ({
      id: config._id,
      platformFeeRate: config.platformFeeRate,
      platformFeePercentage: (config.platformFeeRate * 100).toFixed(1),
      isActive: config.isActive,
      effectiveFrom: config.effectiveFrom,
      effectiveTo: config.effectiveTo,
      changeReason: config.changeReason,
      createdBy: config.createdBy?.name || 'Unknown',
      updatedBy: config.updatedBy?.name || null,
      createdAt: config.createdAt,
      version: config.version
    }));

    res.status(200).json({
      success: true,
      data: {
        history: formattedHistory,
        totalChanges: history.length
      }
    });
  } catch (error) {
    console.error('❌ Error fetching platform fee history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform fee history',
      error: error.message
    });
  }
};

// Placeholder functions for other admin endpoints
const getUsers = async (req, res) => {
  res.status(200).json({ success: true, data: { users: [], total: 0 } });
};

const updateUserStatus = async (req, res) => {
  res.status(200).json({ success: true, message: 'User status updated' });
};

const getUser = async (req, res) => {
  res.status(200).json({ success: true, data: {} });
};

const updateUser = async (req, res) => {
  res.status(200).json({ success: true, message: 'User updated' });
};

const getHosts = async (req, res) => {
  res.status(200).json({ success: true, data: { hosts: [], total: 0 } });
};

const approveHost = async (req, res) => {
  res.status(200).json({ success: true, message: 'Host approved' });
};

const rejectHost = async (req, res) => {
  res.status(200).json({ success: true, message: 'Host rejected' });
};

const getProperties = async (req, res) => {
  res.status(200).json({ success: true, data: { properties: [], total: 0 } });
};

const approveListing = async (req, res) => {
  res.status(200).json({ success: true, message: 'Listing approved' });
};

const rejectListing = async (req, res) => {
  res.status(200).json({ success: true, message: 'Listing rejected' });
};

const getBookings = async (req, res) => {
  res.status(200).json({ success: true, data: { bookings: [], total: 0 } });
};

const refundBooking = async (req, res) => {
  res.status(200).json({ success: true, message: 'Refund processed' });
};

const getKYC = async (req, res) => {
  res.status(200).json({ success: true, data: { kyc: [], total: 0 } });
};

const getKYCById = async (req, res) => {
  res.status(200).json({ success: true, data: {} });
};

const verifyKYC = async (req, res) => {
  res.status(200).json({ success: true, message: 'KYC verified' });
};

const rejectKYC = async (req, res) => {
  res.status(200).json({ success: true, message: 'KYC rejected' });
};

const getPayments = async (req, res) => {
  res.status(200).json({ success: true, data: { payments: [], total: 0 } });
};

const processPayout = async (req, res) => {
  res.status(200).json({ success: true, message: 'Payout processed' });
};

const getReviews = async (req, res) => {
  res.status(200).json({ success: true, data: { reviews: [], total: 0 } });
};

const flagReview = async (req, res) => {
  res.status(200).json({ success: true, message: 'Review flagged' });
};

const deleteReview = async (req, res) => {
  res.status(200).json({ success: true, message: 'Review deleted' });
};

const getSettings = async (req, res) => {
  res.status(200).json({ success: true, data: {} });
};

const updateSettings = async (req, res) => {
  res.status(200).json({ success: true, message: 'Settings updated' });
};

const getAnalytics = async (req, res) => {
  res.status(200).json({ success: true, data: {} });
};

const getReports = async (req, res) => {
  res.status(200).json({ success: true, data: {} });
};

const getRecentActivities = async (req, res) => {
  res.status(200).json({ success: true, data: { activities: [] } });
};

const getSystemHealth = async (req, res) => {
    res.status(200).json({
      success: true,
      data: {
      status: 'healthy', 
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date()
    } 
  });
};

// Payment Audit Dashboard
const getPaymentAuditDashboard = async (req, res) => {
  try {
    const { page = 1, limit = 50, severity, action } = req.query;
    
    // Build filter
    const filter = {};
    if (severity) filter['audit.severity'] = severity;
    if (action) filter['audit.action'] = action;
    
    // Get audit logs
    const auditLogs = await PaymentAuditLog.find(filter)
      .populate('user', 'name email')
      .populate('host', 'name email')
      .populate('payment', 'amount status')
      .populate('booking', 'receiptId status')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    // Get summary stats
    const totalLogs = await PaymentAuditLog.countDocuments(filter);
    const validationFailures = await PaymentAuditLog.countDocuments({ 'validation.isValid': false });
    const criticalIssues = await PaymentAuditLog.countDocuments({ 'audit.severity': 'critical' });
    const highIssues = await PaymentAuditLog.countDocuments({ 'audit.severity': 'high' });
    
    res.json({
      success: true,
      data: {
        logs: auditLogs,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(totalLogs / limit),
          total: totalLogs
        },
        summary: {
          totalLogs,
          validationFailures,
          criticalIssues,
          highIssues
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment audit dashboard',
      error: error.message
    });
  }
};

// Get validation failures
const getValidationFailures = async (req, res) => {
  try {
    const failures = await PaymentAuditLog.getValidationFailures(100);
    
    res.json({
      success: true,
      data: failures
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch validation failures',
      error: error.message
    });
  }
};

// Get payment audit details
const getPaymentAuditDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const auditLogs = await PaymentAuditLog.getPaymentAuditLogs(paymentId);
    
    res.json({
      success: true,
      data: auditLogs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment audit details',
      error: error.message
    });
  }
};

module.exports = {
  // Dashboard
  getDashboardStats,
  
  // Platform Fee Management
  getCurrentPlatformFeeRate,
  updatePlatformFeeRate,
  getPlatformFeeHistory,
  
  // Users
  getUsers,
  updateUserStatus,
  getUser,
  updateUser,
  
  // Hosts
  getHosts,
  approveHost,
  rejectHost,
  
  // Properties
  getProperties,
  approveListing,
  rejectListing,
  
  // Bookings
  getBookings,
  refundBooking,
  
  // KYC
  getKYC,
  getKYCById,
  verifyKYC,
  rejectKYC,
  
  // Payments
  getPayments,
  processPayout,
  
  // Reviews
  getReviews,
  flagReview,
  deleteReview,
  
  // Settings
  getSettings,
  updateSettings,
  
  // Analytics & Reports
  getAnalytics,
  getReports,
  
  // System
  getRecentActivities,
  getSystemHealth,
  
  // Payment Audit
  getPaymentAuditDashboard,
  getValidationFailures,
  getPaymentAuditDetails
}; 
