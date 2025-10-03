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
  console.error('Please check your .env file in the backend directory');
  process.exit(1);
}

const port = process.env.PORT || 5001;

console.log('🚀 Starting TripMe Backend Server...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', port);
console.log('Frontend URL:', process.env.FRONTEND_URL);

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

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? 
    process.env.ALLOWED_ORIGINS.split(',').map(url => url.trim()).filter(url => url) : 
    ['http://localhost:3000'], // Default fallback for local development only
  credentials: true,
  optionsSuccessStatus: 200
};

// Apply security middleware
app.use(helmet);
app.use(cors(corsOptions));
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

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Server is working' });
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
// Hourly booking routes moved to main booking routes

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Backend server is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Serve static files from frontend build (if exists)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/out')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/out/index.html'));
  });
}

// Error handling middleware
const { errorHandler, notFound } = require('./middlewares/error.middleware');

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Backend server running on port ${port}`);
  console.log(`🌐 Server URL: http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
});