const Admin = require('../models/Admin');
const User = require('../models/User');
const Property = require('../models/Property');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const KycVerification = require('../models/KycVerification');
const Notification = require('../models/Notification');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const Wishlist = require('../models/Wishlist');
const { sendEmail, sendAccountSuspendedEmail, sendAccountActivatedEmail } = require('../utils/sendEmail');

// @desc    Admin signup (for initial setup only)
// @route   POST /api/admin/signup
// @access  Public (but should be restricted in production)
const adminSignup = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone, secretKey } = req.body;

    // Validate input
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Validate secret key (should match environment variable)
    const expectedSecretKey = process.env.ADMIN_SIGNUP_SECRET_KEY || 'TRIPME_ADMIN_2024';
    if (secretKey !== expectedSecretKey) {
      return res.status(403).json({
        success: false,
        message: 'Invalid secret key for admin signup'
      });
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'Admin with this email already exists'
      });
    }

    // Check if user with this email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create admin
    const admin = await Admin.create({
      name,
      email,
      password,
      phone: phone || '',
      role: 'admin',
      isActive: true,
      permissions: [
        {
          module: 'users',
          canView: true,
          canEdit: true,
          canDelete: true
        },
        {
          module: 'properties',
          canView: true,
          canEdit: true,
          canDelete: true
        },
        {
          module: 'bookings',
          canView: true,
          canEdit: true,
          canDelete: true
        },
        {
          module: 'payments',
          canView: true,
          canEdit: true,
          canDelete: true
        },
        {
          module: 'kyc',
          canView: true,
          canEdit: true,
          canDelete: true
        },
        {
          module: 'reviews',
          canView: true,
          canEdit: true,
          canDelete: true
        },
        {
          module: 'admin',
          canView: true,
          canEdit: true,
          canDelete: true
        }
      ],
      accessLevel: 'super',
      allowedIPs: [], // No IP restrictions initially
      loginHistory: [],
      failedLoginAttempts: 0,
      isLocked: false,
      lastLogin: null,
      lastActivity: new Date()
    });

    // Generate JWT token with enhanced security
    const token = require('jsonwebtoken').sign(
      { 
        id: admin._id, 
        role: 'admin',
        accessLevel: admin.accessLevel,
        sessionId: Date.now().toString()
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      data: {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          isActive: admin.isActive,
          permissions: admin.permissions
        },
        token
      }
    });

  } catch (error) {
    console.error('Admin signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating admin account',
      error: error.message
    });
  }
};

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check if admin exists
    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Check if account is locked
    if (admin.isLocked && admin.lockoutUntil && admin.lockoutUntil > new Date()) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked. Please try again later.'
      });
    }

    // IP whitelist check (if configured)
    if (admin.allowedIPs && admin.allowedIPs.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress;
      if (!admin.allowedIPs.includes(clientIP)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied from this IP address'
        });
      }
    }

    // Check if password is correct
    const isPasswordCorrect = await admin.comparePassword(password);
    if (!isPasswordCorrect) {
      // Increment failed login attempts
      admin.failedLoginAttempts += 1;
      
      // Add failed login to history
      admin.loginHistory.push({
        timestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false
      });
      
      // Lock account after 5 failed attempts
      if (admin.failedLoginAttempts >= 5) {
        admin.isLocked = true;
        admin.lockoutUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      }
      
      await admin.save();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Reset failed login attempts on successful login
    admin.failedLoginAttempts = 0;
    admin.isLocked = false;
    admin.lockoutUntil = null;
    admin.lastLogin = new Date();
    admin.lastActivity = new Date();
    
    // Add to login history
    admin.loginHistory.push({
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success: true
    });
    
    // Keep only last 10 login attempts
    if (admin.loginHistory.length > 10) {
      admin.loginHistory = admin.loginHistory.slice(-10);
    }
    
    await admin.save();

    // Generate JWT token with enhanced security
    const token = require('jsonwebtoken').sign(
      { 
        id: admin._id, 
        role: 'admin',
        accessLevel: admin.accessLevel,
        sessionId: Date.now().toString()
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Store session token
    admin.sessionTokens.push({
      token,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Keep only last 5 active sessions
    if (admin.sessionTokens.length > 5) {
      admin.sessionTokens = admin.sessionTokens.slice(-5);
    }

    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          accessLevel: admin.accessLevel,
          require2FA: admin.require2FA,
          permissions: admin.permissions
        },
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    // User stats
    const totalUsers = await User.countDocuments();
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: startOfMonth }
    });
    const pendingKYC = await User.countDocuments({
      'kyc.status': 'pending'
    });
    const totalHosts = await User.countDocuments({ role: 'host' });
    const activeHosts = await User.countDocuments({ 
      role: 'host', 
      'kyc.status': 'verified' 
    });

    // Property stats
    const totalProperties = await Property.countDocuments();
    const pendingPropertyApprovals = await Property.countDocuments({
      status: 'draft'
    });
    const activeProperties = await Property.countDocuments({
      status: 'published'
    });
    const suspendedProperties = await Property.countDocuments({
      status: 'suspended'
    });

    // Booking stats
    const totalBookings = await Booking.countDocuments();
    const bookingsThisMonth = await Booking.countDocuments({
      createdAt: { $gte: startOfMonth }
    });
    const pendingBookings = await Booking.countDocuments({
      status: 'pending'
    });
    const completedBookings = await Booking.countDocuments({
      status: 'completed'
    });
    const cancelledBookings = await Booking.countDocuments({
      status: 'cancelled'
    });

    // Enhanced payment stats using PaymentService
    const PaymentService = require('../services/payment.service');
    const paymentStats = await PaymentService.getAdminPaymentStats();
    
    // Get payout statistics
    const Payout = require('../models/Payout');
    const pendingPayoutsCount = await Payout.countDocuments({ status: 'pending' });
    const totalPayouts = await Payout.countDocuments({ status: 'completed' });
    
    // Calculate monthly revenue
    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startOfMonth }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Review stats
    const totalReviews = await Review.countDocuments();
    const averageRating = await Review.aggregate([
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);

    // Service stats
    const totalServices = await Service.countDocuments();
    const activeServices = await Service.countDocuments({ status: 'published' });

    // Growth metrics
    const lastMonthUsers = await User.countDocuments({
      createdAt: { $gte: lastMonth, $lt: startOfMonth }
    });
    const lastMonthBookings = await Booking.countDocuments({
      createdAt: { $gte: lastMonth, $lt: startOfMonth }
    });
    const lastMonthRevenue = await Payment.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: lastMonth, $lt: startOfMonth }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Recent activities
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt kyc');

    const recentBookings = await Booking.find()
      .populate('user', 'name email')
      .populate('host', 'name email')
      .populate('listing', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentProperties = await Property.find()
      .populate('host', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentPayments = await Payment.find()
      .populate('booking')
      .sort({ createdAt: -1 })
      .limit(5);

    // System health
    const systemHealth = {
      database: 'connected',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      activeConnections: 0 // This would need to be tracked separately
    };

    // Quick actions data
    const quickActions = {
      pendingKYCCount: pendingKYC,
      pendingPropertiesCount: pendingPropertyApprovals,
      pendingBookingsCount: pendingBookings,
      pendingPayoutsCount: pendingPayoutsCount
    };

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          newThisMonth: newUsersThisMonth,
          pendingKYC,
          totalHosts,
          activeHosts,
          growthRate: lastMonthUsers > 0 ? ((newUsersThisMonth - lastMonthUsers) / lastMonthUsers * 100).toFixed(2) : 0
        },
        properties: {
          total: totalProperties,
          pendingApprovals: pendingPropertyApprovals,
          active: activeProperties,
          suspended: suspendedProperties
        },
        bookings: {
          total: totalBookings,
          thisMonth: bookingsThisMonth,
          pending: pendingBookings,
          completed: completedBookings,
          cancelled: cancelledBookings,
          growthRate: lastMonthBookings > 0 ? ((bookingsThisMonth - lastMonthBookings) / lastMonthBookings * 100).toFixed(2) : 0
        },
        revenue: {
          total: paymentStats.totalAmount,
          thisMonth: monthlyRevenue[0]?.total || 0,
          platformFees: paymentStats.totalPlatformFees,
          netRevenue: paymentStats.netRevenue,
          pendingPayouts: pendingPayoutsCount,
          totalPayouts: totalPayouts,
          growthRate: lastMonthRevenue[0]?.total > 0 ? ((monthlyRevenue[0]?.total || 0) - lastMonthRevenue[0]?.total) / lastMonthRevenue[0]?.total * 100 : 0
        },
        reviews: {
          total: totalReviews,
          averageRating: averageRating[0]?.avgRating || 0
        },
        services: {
          total: totalServices,
          active: activeServices
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard stats',
      error: error.message
    });
  }
};

// @desc    Get all users with filters
// @route   GET /api/admin/users
// @access  Private (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      status,
      kycStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (role) query.role = role;
    if (status) query.accountStatus = status;
    if (kycStatus) query['kyc.status'] = kycStatus;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const users = await User.find(query)
      .select('-password')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    // Get additional statistics for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        // Get user's bookings count
        const bookingsCount = await Booking.countDocuments({ user: user._id });
        
        // Get user's properties count (if host)
        const propertiesCount = user.role === 'host' ? 
          await Property.countDocuments({ host: user._id }) : 0;
        
        // Get user's reviews count
        const reviewsCount = await Review.countDocuments({ reviewedUser: user._id });
        
        // Get user's total spending (for guests)
        const totalSpending = user.role === 'guest' ? 
          await Payment.aggregate([
            { $match: { user: user._id, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]) : [];
        
        // Get user's total earnings (for hosts)
        const totalEarnings = user.role === 'host' ? 
          await Payment.aggregate([
            { $match: { 'booking.host': user._id, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]) : [];

        // Get KYC status
        const kycStatus = user.kyc ? user.kyc.status : 'not_submitted';

        return {
          ...user.toObject(),
          stats: {
            bookingsCount,
            propertiesCount,
            reviewsCount,
            totalSpending: totalSpending[0]?.total || 0,
            totalEarnings: totalEarnings[0]?.total || 0,
            kycStatus
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// @desc    Get user details
// @route   GET /api/admin/users/:id
// @access  Private (Admin only)
const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('-password')
      .populate('savedListings', 'title images pricing');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's properties (if host)
    const properties = await Property.find({ host: id })
      .select('title status pricing rating reviewCount createdAt images')
      .sort({ createdAt: -1 });

    // Get user's bookings
    const bookings = await Booking.find({ user: id })
      .populate('listing', 'title images pricing')
      .populate('host', 'name email')
      .populate('service', 'title')
      .sort({ createdAt: -1 });

    // Get user's reviews
    const reviews = await Review.find({ reviewedUser: id })
      .populate('reviewer', 'name profileImage')
      .sort({ createdAt: -1 });

    // Get user's payments
    const payments = await Payment.find({ user: id })
      .populate('booking', 'listing host')
      .sort({ createdAt: -1 });

    // Get user's KYC details
    const kycDetails = user.kyc ? await KycVerification.findOne({ user: id }) : null;

    // Get user's notifications
    const notifications = await Notification.find({ user: id })
      .sort({ createdAt: -1 })
      .limit(20);

    // Get user's wishlist
    const wishlist = await Wishlist.find({ user: id })
      .populate('listing', 'title images pricing')
      .sort({ createdAt: -1 });

    // Calculate statistics
    const totalBookings = bookings.length;
    const totalProperties = properties.length;
    const totalReviews = reviews.length;
    const totalPayments = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    const totalSpending = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    const totalEarnings = user.role === 'host' ? 
      await Payment.aggregate([
        { $match: { 'booking.host': id, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]) : [];

    // Get recent activity
    const recentActivity = [
      ...bookings.map(b => ({ type: 'booking', data: b, date: b.createdAt })),
      ...reviews.map(r => ({ type: 'review', data: r, date: r.createdAt })),
      ...payments.map(p => ({ type: 'payment', data: p, date: p.createdAt }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    res.status(200).json({
      success: true,
      data: {
        user,
        properties,
        bookings,
        reviews,
        payments,
        kycDetails,
        notifications,
        wishlist,
        statistics: {
          totalBookings,
          totalProperties,
          totalReviews,
          totalPayments,
          totalSpending,
          totalEarnings: totalEarnings[0]?.total || 0
        },
        recentActivity
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user details',
      error: error.message
    });
  }
};

// @desc    Update user status
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin only)
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { accountStatus, role, reason } = req.body;

    console.log('updateUserStatus called with:', { id, accountStatus, role, reason });

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Store the old status before updating
    const oldStatus = user.accountStatus;
    console.log('User status change:', { oldStatus, newStatus: accountStatus });

    // Update user status
    if (accountStatus) user.accountStatus = accountStatus;
    if (role) user.role = role;

    await user.save();

    // Create notification for user
    await Notification.create({
      user: user._id,
      type: 'system',
      title: 'Account Status Updated',
      message: `Your account status has been updated to ${accountStatus || user.accountStatus}`,
      metadata: { newStatus: accountStatus || user.accountStatus }
    });

    // Send email notification based on status change
    if (accountStatus === 'suspended') {
      console.log('Sending suspension email to:', user.email);
      try {
        await sendAccountSuspendedEmail(
          user.email,
          user.name,
          { reason: reason || 'Policy violation' }
        );
        console.log('Suspension email sent successfully');
      } catch (emailError) {
        console.error('Error sending suspension email:', emailError);
        // Don't fail the request if email fails
      }
    } else if (accountStatus === 'active' && oldStatus === 'suspended') {
      console.log('Sending activation email to:', user.email);
      try {
        await sendAccountActivatedEmail(
          user.email,
          user.name,
          { reason: 'Account reactivated by admin' }
        );
        console.log('Activation email sent successfully');
      } catch (emailError) {
        console.error('Error sending activation email:', emailError);
        // Don't fail the request if email fails
      }
    } else {
      console.log('No email sent. Conditions not met:', { 
        accountStatus, 
        oldStatus, 
        shouldSendActivation: accountStatus === 'active' && oldStatus === 'suspended',
        accountStatusType: typeof accountStatus,
        oldStatusType: typeof oldStatus,
        accountStatusEqualsActive: accountStatus === 'active',
        oldStatusEqualsSuspended: oldStatus === 'suspended'
      });
      
      // Also check for other possible status values
      console.log('Possible status values:', {
        accountStatus,
        oldStatus,
        accountStatusLowerCase: accountStatus?.toLowerCase(),
        oldStatusLowerCase: oldStatus?.toLowerCase()
      });
    }

    res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Error in updateUserStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user status',
      error: error.message
    });
  }
};

// @desc    Test email functionality
// @route   POST /api/admin/test-email
// @access  Private (Admin only)
const testEmail = async (req, res) => {
  try {
    const { email, template } = req.body;
    
    console.log('Testing email with:', { email, template });
    
    if (template === 'accountActivated') {
      await sendAccountActivatedEmail(
        email,
        'Test User',
        { reason: 'Test activation email' }
      );
    } else if (template === 'accountSuspended') {
      await sendAccountSuspendedEmail(
        email,
        'Test User',
        { reason: 'Test suspension email' }
      );
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid template. Use "accountActivated" or "accountSuspended"'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Test email sent successfully'
    });
  } catch (error) {
    console.error('Error in testEmail:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test email',
      error: error.message
    });
  }
};

// @desc    Get all KYC applications
// @route   GET /api/admin/kyc
// @access  Private (Admin only)
const getAllKYC = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = { 'kyc.status': { $exists: true } };

    if (status) query['kyc.status'] = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'kyc.documentNumber': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const kycApplications = await User.find(query)
      .select('name email phone kyc createdAt')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        kycApplications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC applications',
      error: error.message
    });
  }
};

// @desc    Get detailed KYC information with documents
// @route   GET /api/admin/kyc/:userId
// @access  Private (Admin only)
const getKYCDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('name email phone kyc createdAt');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get detailed KYC verification data
    const kycVerification = await KycVerification.findOne({ user: userId });
    
    if (!kycVerification) {
      return res.status(404).json({
        success: false,
        message: 'KYC verification not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user,
        kycVerification
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC details',
      error: error.message
    });
  }
};

// @desc    Get pending KYC applications
// @route   GET /api/admin/kyc/pending
// @access  Private (Admin only)
const getPendingKYC = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const kycApplications = await User.find({
      'kyc.status': 'pending'
    })
    .select('name email phone kyc createdAt')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await User.countDocuments({
      'kyc.status': 'pending'
    });

    res.status(200).json({
      success: true,
      data: {
        kycApplications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC applications',
      error: error.message
    });
  }
};

// @desc    Approve/reject KYC application
// @route   PUT /api/admin/kyc/:userId/verify
// @access  Private (Admin only)
const verifyKYC = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, rejectionReason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if there's a pending KYC verification
    const kycVerification = await KycVerification.findOne({ 
      user: user._id, 
      status: 'pending' 
    });

    if (!kycVerification) {
      return res.status(400).json({
        success: false,
        message: 'No pending KYC application found'
      });
    }

    // Update KYC verification status
    kycVerification.status = status;
    if (status === 'rejected' && rejectionReason) {
      kycVerification.rejectionReason = rejectionReason;
    }
    kycVerification.verifiedBy = req.user._id;
    kycVerification.verifiedAt = new Date();
    await kycVerification.save();

    // Update user KYC status
    user.kyc.status = status;
    if (status === 'rejected' && rejectionReason) {
      user.kyc.rejectionReason = rejectionReason;
    }

    // If approved, upgrade user to host role
    if (status === 'verified') {
      user.role = 'host';
      user.isVerified = true;
    }

    await user.save();

    // Create notification for user
    await Notification.create({
      user: user._id,
      type: 'system',
      title: `KYC ${status === 'verified' ? 'Approved' : 'Rejected'}`,
      message: status === 'verified' 
        ? 'Your KYC has been approved! You can now start hosting.'
        : `Your KYC has been rejected. Reason: ${rejectionReason}`,
      metadata: { kycStatus: status }
    });

    // Send email notification
    const emailSubject = status === 'verified' ? 'KYC Approved' : 'KYC Rejected';
    const emailMessage = status === 'verified'
      ? 'Congratulations! Your KYC has been approved. You can now start creating listings and services.'
      : `Your KYC application has been rejected. Reason: ${rejectionReason}. Please submit new documents.`;

    await sendEmail(user.email, emailSubject, emailMessage);

    res.status(200).json({
      success: true,
      message: `KYC ${status === 'verified' ? 'approved' : 'rejected'} successfully`,
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying KYC',
      error: error.message
    });
  }
};

// @desc    Get pending property approvals
// @route   GET /api/admin/properties/pending
// @access  Private (Admin only)
const getAllProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      type,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } },
        { 'location.state': { $regex: search, $options: 'i' } }
      ];
    }

    if (status) query.status = status;
    if (type) query.type = type;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const properties = await Property.find(query)
      .populate('host', 'name email phone')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Property.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        properties,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching properties',
      error: error.message
    });
  }
};

const getPendingProperties = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const properties = await Property.find({ status: 'draft' })
      .populate('host', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Property.countDocuments({ status: 'draft' });

    res.status(200).json({
      success: true,
      data: {
        properties,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pending properties',
      error: error.message
    });
  }
};

// @desc    Approve/reject property
// @route   PUT /api/admin/properties/:id/approve
// @access  Private (Admin only)
const approveProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const property = await Property.findById(id).populate('host', 'name email');
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    if (property.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Property is not in draft status'
      });
    }

    // Update property status
    property.status = status;
    if (status === 'suspended' && rejectionReason) {
      property.rejectionReason = rejectionReason;
    }

    await property.save();

    // Create notification for host
    await Notification.create({
      user: property.host._id,
      type: 'property',
      title: `Property ${status === 'published' ? 'Approved' : 'Rejected'}`,
      message: status === 'published'
        ? `Your property "${property.title}" has been approved and is now live!`
        : `Your property "${property.title}" has been rejected. Reason: ${rejectionReason}`,
      metadata: { propertyId: property._id, status }
    });

    // Send email notification
    const emailSubject = status === 'published' ? 'Property Approved' : 'Property Rejected';
    const emailMessage = status === 'published'
      ? `Congratulations! Your property "${property.title}" has been approved and is now live on our platform.`
      : `Your property "${property.title}" has been rejected. Reason: ${rejectionReason}. Please make necessary changes and resubmit.`;

    await sendEmail(property.host.email, emailSubject, emailMessage);

    res.status(200).json({
      success: true,
      message: `Property ${status === 'published' ? 'approved' : 'rejected'} successfully`,
      data: { property }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error approving property',
      error: error.message
    });
  }
};

// @desc    Get all bookings with filters
// @route   GET /api/admin/bookings
// @access  Private (Admin only)
const getAllBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      bookingType,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    if (status) query.status = status;
    if (bookingType) query.bookingType = bookingType;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const bookings = await Booking.find(query)
      .populate('user', 'name email')
      .populate('host', 'name email')
      .populate('listing', 'title')
      .populate('service', 'title')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings',
      error: error.message
    });
  }
};

// @desc    Get system analytics
// @route   GET /api/admin/analytics
// @access  Private (Admin only)
const getSystemAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let startDate;
    const now = new Date();
    
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // User growth
    const userGrowth = await User.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Booking trends
    const bookingTrends = await Booking.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
          revenue: { $sum: "$totalAmount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Property growth
    const propertyGrowth = await Property.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Top performing properties
    const topProperties = await Property.aggregate([
      { $match: { status: 'published' } },
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'listing',
          as: 'bookings'
        }
      },
      {
        $addFields: {
          bookingCount: { $size: '$bookings' },
          totalRevenue: {
            $sum: '$bookings.totalAmount'
          }
        }
      },
      { $sort: { bookingCount: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        userGrowth,
        bookingTrends,
        propertyGrowth,
        topProperties
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics',
      error: error.message
    });
  }
};

// @desc    Get admin profile
// @route   GET /api/admin/profile
// @access  Private (Admin only)
const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('-password');
    
    res.status(200).json({
      success: true,
      data: { admin }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching admin profile',
      error: error.message
    });
  }
};

// @desc    Update admin profile
// @route   PUT /api/admin/profile
// @access  Private (Admin only)
const updateAdminProfile = async (req, res) => {
  try {
    const { name, email, profileImage } = req.body;

    const admin = await Admin.findByIdAndUpdate(
      req.user.id,
      { name, email, profileImage },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { admin }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

// @desc    Get all hosts
// @route   GET /api/admin/hosts
// @access  Private (Admin only)
const getAllHosts = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = { role: 'host' };
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Get hosts with pagination
    const hosts = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('kyc', 'status submittedAt');

    // Get total count
    const total = await User.countDocuments(query);

    // Get additional stats for each host
    const hostsWithStats = await Promise.all(
      hosts.map(async (host) => {
        const propertiesCount = await Property.countDocuments({ host: host._id });
        const bookingsCount = await Booking.countDocuments({ host: host._id });
        const totalEarnings = await Booking.aggregate([
          { $match: { host: host._id, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        return {
          ...host.toObject(),
          propertiesCount,
          bookingsCount,
          totalEarnings: totalEarnings[0]?.total || 0
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        hosts: hostsWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching hosts',
      error: error.message
    });
  }
};

// @desc    Approve host
// @route   PUT /api/admin/hosts/:id/approve
// @access  Private (Admin only)
const approveHost = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'host') {
      return res.status(400).json({
        success: false,
        message: 'User is not a host'
      });
    }

    // Update user status
    user.status = 'active';
    await user.save();

    // Create notification
    await Notification.create({
      user: user._id,
      type: 'system',
      title: 'Host Account Approved',
      message: 'Your host account has been approved! You can now start hosting.',
      isRead: false
    });

    // Send email notification
    const emailSubject = 'Host Account Approved - TripMe';
    const emailMessage = `
      <h2>Congratulations! 🎉</h2>
      <p>Your host account has been approved by our admin team.</p>
      <p>You can now:</p>
      <ul>
        <li>Create and manage your properties</li>
        <li>Receive bookings from guests</li>
        <li>Earn money by hosting</li>
      </ul>
      <p>Start your hosting journey today!</p>
    `;

    await sendEmail(user.email, emailSubject, emailMessage);

    res.status(200).json({
      success: true,
      message: 'Host approved successfully',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error approving host',
      error: error.message
    });
  }
};

// @desc    Reject host
// @route   PUT /api/admin/hosts/:id/reject
// @access  Private (Admin only)
const rejectHost = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'host') {
      return res.status(400).json({
        success: false,
        message: 'User is not a host'
      });
    }

    // Update user status
    user.status = 'suspended';
    await user.save();

    // Create notification
    await Notification.create({
      user: user._id,
      type: 'system',
      title: 'Host Account Rejected',
      message: `Your host account has been rejected. Reason: ${reason}`,
      isRead: false
    });

    // Send email notification
    const emailSubject = 'Host Account Rejected - TripMe';
    const emailMessage = `
      <h2>Host Account Update</h2>
      <p>We regret to inform you that your host account has been rejected.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p>If you believe this is an error or would like to appeal, please contact our support team.</p>
    `;

    await sendEmail(user.email, emailSubject, emailMessage);

    res.status(200).json({
      success: true,
      message: 'Host rejected successfully',
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error rejecting host',
      error: error.message
    });
  }
};

// @desc    Get all payments
// @route   GET /api/admin/payments
// @access  Private (Admin only)
const getAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { 'paymentDetails.transactionId': { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } },
        { 'host.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Get payments with pagination and populate details
    const payments = await Payment.find(query)
      .populate('user', 'name email')
      .populate('host', 'name email')
      .populate('booking', 'totalAmount currency checkIn checkOut receiptId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Payment.countDocuments(query);

    // Enhance payments with payout and refund information
    const enhancedPayments = await Promise.all(payments.map(async (payment) => {
      const Payout = require('../models/Payout');
      const Refund = require('../models/Refund');
      
      const payout = await Payout.findOne({ payment: payment._id })
        .select('status scheduledDate processedDate amount method');
      
      const refunds = await Refund.find({ payment: payment._id })
        .select('amount status reason type');
      
      return {
        id: payment._id,
        transactionId: payment.paymentDetails?.transactionId || payment._id.toString(),
        hostName: payment.host?.name || 'N/A',
        hostEmail: payment.host?.email || 'N/A',
        guestName: payment.user?.name || 'N/A',
        guestEmail: payment.user?.email || 'N/A',
        listingTitle: payment.booking?.receiptId || 'N/A',
        amount: payment.amount,
        platformFee: payment.commission?.platformFee || 0,
        hostEarning: payment.commission?.hostEarning || 0,
        status: payment.status,
        paymentDate: payment.createdAt,
        payout: payout,
        refunds: refunds,
        totalRefunded: payment.totalRefunded || 0,
        netAmount: payment.netAmount || payment.amount,
        payoutAmount: payment.payoutAmount || 0,
        paymentMethod: payment.paymentMethod || 'Online',
        bookingId: payment.booking?._id || 'N/A',
        bookingDates: payment.booking ? {
          checkIn: payment.booking.checkIn,
          checkOut: payment.booking.checkOut
        } : null
      };
    }));

    res.status(200).json({
      success: true,
      data: {
        payments: enhancedPayments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching payments',
      error: error.message
    });
  }
};

// @desc    Process manual payout
// @route   POST /api/admin/payments/:id/payout
// @access  Private (Admin only)
const processManualPayout = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, notes } = req.body;

    const payment = await Payment.findById(id).populate('booking');
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Update payment status
    payment.status = 'paid_out';
    payment.paid_out = true;
    payment.payout_date = new Date();
    payment.payout_notes = notes;

    await payment.save();

    // Create notification for host
    if (payment.booking?.host) {
      await Notification.create({
        user: payment.booking.host,
        type: 'payment',
        title: 'Payout Processed',
        message: `Your payout of ₹${amount} has been processed successfully.`,
        metadata: { paymentId: payment._id, amount }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Manual payout processed successfully',
      data: { payment }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing manual payout',
      error: error.message
    });
  }
};

// @desc    Get all reviews
// @route   GET /api/admin/reviews
// @access  Private (Admin only)
const getAllReviews = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { content: { $regex: search, $options: 'i' } },
        { 'reviewer.name': { $regex: search, $options: 'i' } },
        { 'reviewee.name': { $regex: search, $options: 'i' } },
        { 'property.title': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const reviews = await Review.find(query)
      .populate('reviewer', 'name email')
      .populate('reviewee', 'name email')
      .populate('property', 'title')
      .populate('booking', 'checkIn checkOut')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(query);

    // Transform data for frontend
    const transformedReviews = reviews.map(review => ({
      id: review._id,
      reviewerName: review.reviewer?.name || 'Unknown User',
      reviewerEmail: review.reviewer?.email || 'No email',
      revieweeName: review.reviewee?.name || 'Unknown User',
      revieweeEmail: review.reviewee?.email || 'No email',
      propertyTitle: review.property?.title || 'Unknown Property',
      rating: review.rating,
      content: review.content,
      status: review.status || 'active',
      createdAt: review.createdAt,
      flaggedReason: review.flaggedReason,
      bookingDates: review.booking ? {
        checkIn: review.booking.checkIn,
        checkOut: review.booking.checkOut
      } : undefined
    }));

    res.status(200).json({
      success: true,
      data: {
        reviews: transformedReviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching reviews',
      error: error.message
    });
  }
};

// @desc    Flag a review
// @route   PUT /api/admin/reviews/:id/flag
// @access  Private (Admin only)
const flagReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Update review status
    review.status = 'flagged';
    review.flaggedReason = reason;
    review.flaggedAt = new Date();
    review.flaggedBy = req.admin._id;

    await review.save();

    // Create notification for reviewer
    await Notification.create({
      user: review.reviewer,
      type: 'system',
      title: 'Review Flagged',
      message: `Your review has been flagged for review. Reason: ${reason}`,
      metadata: { reviewId: review._id, reason }
    });

    res.status(200).json({
      success: true,
      message: 'Review flagged successfully',
      data: { review }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error flagging review',
      error: error.message
    });
  }
};

// @desc    Delete a review
// @route   DELETE /api/admin/reviews/:id
// @access  Private (Admin only)
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Soft delete - update status instead of removing
    review.status = 'deleted';
    review.deletedAt = new Date();
    review.deletedBy = req.admin._id;

    await review.save();

    // Create notification for reviewer
    await Notification.create({
      user: review.reviewer,
      type: 'system',
      title: 'Review Removed',
      message: 'Your review has been removed from the platform.',
      metadata: { reviewId: review._id }
    });

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting review',
      error: error.message
    });
  }
};

// @desc    Get recent activities for admin dashboard
// @route   GET /api/admin/activities/recent
// @access  Private (Admin only)
const getRecentActivities = async (req, res) => {
  try {
    // Get recent users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt kyc');

    // Get recent bookings
    const recentBookings = await Booking.find()
      .populate('user', 'name email')
      .populate('host', 'name email')
      .populate('listing', 'title')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get recent properties
    const recentProperties = await Property.find()
      .populate('host', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get recent payments
    const recentPayments = await Payment.find()
      .populate('booking')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        users: recentUsers,
        bookings: recentBookings,
        properties: recentProperties,
        payments: recentPayments
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching recent activities',
      error: error.message
    });
  }
};

// @desc    Get system health information
// @route   GET /api/admin/system/health
// @access  Private (Admin only)
const getSystemHealth = async (req, res) => {
  try {
    // Basic system health check
    const systemHealth = {
      database: 'connected', // This could be enhanced with actual DB connection check
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      activeConnections: 0, // This would need to be tracked separately
      timestamp: new Date(),
      version: process.version,
      platform: process.platform,
      arch: process.arch
    };

    // Check database connection
    try {
      await User.findOne().limit(1);
      systemHealth.database = 'connected';
    } catch (dbError) {
      systemHealth.database = 'disconnected';
      console.error('Database connection check failed:', dbError);
    }

    res.status(200).json({
      success: true,
      data: systemHealth
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching system health',
      error: error.message
    });
  }
};

module.exports = {
  adminSignup,
  adminLogin,
  getDashboardStats,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  testEmail,
  getAllKYC,
  getKYCDetails,
  getPendingKYC,
  verifyKYC,
  getAllProperties,
  getPendingProperties,
  approveProperty,
  getAllBookings,
  getSystemAnalytics,
  getAdminProfile,
  updateAdminProfile,
  getAllHosts,
  approveHost,
  rejectHost,
  getAllPayments,
  processManualPayout,
  getAllReviews,
  flagReview,
  deleteReview,
  getRecentActivities,
  getSystemHealth
}; 