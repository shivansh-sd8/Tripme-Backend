require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const app = express();
const mongoose = require('mongoose'); // Added missing import for mongoose

// Security imports
const { createHelmet, createRateLimiters, securityConfig } = require('./config/security.config');
const auditService = require('./services/audit.service');

// Environment variables validation
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET', 'PORT'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

const port = process.env.PORT;

console.log('🚀 Starting TripMe Backend Server...');
console.log('Environment:', process.env.NODE_ENV || 'production');
console.log('Port:', port);

// Connect to database
connectDB();

// Setup periodic cleanup of expired blocked bookings
const bookingController = require('./controllers/booking.controller');
const availabilityController = require('./controllers/availability.controller');

// Run cleanup every 3 minutes for more responsive cleanup
setInterval(async () => {
  try {
    console.log('🔄 Running periodic cleanup...');
    await bookingController.cleanupExpiredBlockedBookings();
    await availabilityController.cleanupExpiredBlockedAvailability();
  } catch (error) {
    console.error('Error in periodic cleanup:', error);
  }
}, 3 * 60 * 1000); // 3 minutes

// Also run cleanup on startup
setTimeout(async () => {
  try {
    console.log('🚀 Running startup cleanup...');
    await bookingController.cleanupExpiredBlockedBookings();
    await availabilityController.cleanupExpiredBlockedAvailability();
  } catch (error) {
    console.error('Error in startup cleanup:', error);
  }
}, 5000); // Wait 5 seconds after startup

// Security middleware setup
const helmet = createHelmet();
const rateLimiters = createRateLimiters();

// Helper function to normalize URLs (remove trailing slashes, ensure protocol)
const normalizeOrigin = (url) => {
  if (!url) return null;
  // Remove trailing slashes
  let normalized = url.trim().replace(/\/+$/, '');
  // If no protocol, assume https for production
  if (!normalized.match(/^https?:\/\//)) {
    normalized = `https://${normalized}`;
  }
  return normalized;
};

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [];
    
    // Add FRONTEND_URL if set (handle comma-separated)
    if (process.env.FRONTEND_URL) {
      const urls = process.env.FRONTEND_URL.split(',')
        .map(url => normalizeOrigin(url))
        .filter(url => url);
      allowedOrigins.push(...urls);
    }
    
    // Add ALLOWED_ORIGINS if set (comma-separated list)
    if (process.env.ALLOWED_ORIGINS) {
      const additionalOrigins = process.env.ALLOWED_ORIGINS.split(',')
        .map(url => normalizeOrigin(url))
        .filter(url => url);
      allowedOrigins.push(...additionalOrigins);
    }
    
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) {
      return callback(null, true);
    }
    
    // Normalize the incoming origin
    const normalizedOrigin = normalizeOrigin(origin);
    
    // Check if origin is in allowed list (case-insensitive comparison)
    const isAllowed = allowedOrigins.some(allowed => {
      const normalizedAllowed = normalizeOrigin(allowed);
      return normalizedAllowed && normalizedAllowed.toLowerCase() === normalizedOrigin.toLowerCase();
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('🚫 CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

// Apply security middleware
app.use(helmet);

// CORS middleware - must be before other middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

app.use(express.json({ limit: securityConfig.validation.maxRequestSize }));
app.use(express.urlencoded({ extended: true, limit: securityConfig.validation.maxRequestSize }));

// Global rate limiting
app.use('/api/admin', rateLimiters.adminAPI);
app.use('/api/auth', rateLimiters.login);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Root route handler (for health checks from Render, etc.)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'TripMe Backend API is running',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    endpoints: {
      health: '/api/health',
      api: '/api'
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  };
  
  res.status(200).json(healthCheck);
});

// Public API endpoints (no authentication required)
app.get('/api/public/platform-fee', async (req, res) => {
  try {
    const PricingConfig = require('./models/PricingConfig');
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
    console.error('Error fetching platform fee rate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform fee rate'
    });
  }
});

// API Routes
console.log('🔍 Loading auth routes...');
app.use('/api/auth', require('./routes/auth.routes'));
console.log('🔍 Loading admin routes...');
app.use('/api/admin', require('./routes/admin.routes'));
console.log('🔍 Admin routes loaded successfully');
app.use('/api/kyc', require('./routes/kyc.routes'));
app.use('/api/host', require('./routes/host.routes'));
app.use('/api/listings', require('./routes/listing.routes'));
app.use('/api/bookings', require('./routes/booking.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/services', require('./routes/service.routes'));
app.use('/api/stories', require('./routes/story.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/payouts', require('./routes/payout.routes'));
app.use('/api/reviews', require('./routes/review.routes'));
app.use('/api/wishlist', require('./routes/wishlist.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/coupons', require('./routes/coupon.routes'));
app.use('/api/support', require('./routes/support.routes'));
app.use('/api/upload', require('./routes/upload.routes'));
app.use('/api/availability', require('./routes/availability.routes'));
app.use('/api/pricing', require('./routes/pricing.routes'));
// Hourly booking routes moved to main booking routes

// Note: Frontend is deployed separately
// No need for static file serving or catch-all routes

// Error handling middleware
const { errorHandler, notFound } = require('./middlewares/error.middleware');

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  console.error('Stack:', err.stack);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  console.error('Stack:', err.stack);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Backend server running on port ${port}`);
  console.log(`📊 Health check: /api/health`);
});