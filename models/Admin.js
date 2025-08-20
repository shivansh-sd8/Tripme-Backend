const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 12,
    validate: {
      validator: function(password) {
        // Require: uppercase, lowercase, number, special character
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
      },
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    },
    select: false
  },
  role: {
    type: String,
    enum: ['super-admin', 'admin', 'moderator', 'support'],
    default: 'admin'
  },
  permissions: [{
    module: String,
    canView: Boolean,
    canEdit: Boolean,
    canDelete: Boolean
  }],
  lastLogin: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  profileImage: String,
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: String,
  // Security features
  isLocked: {
    type: Boolean,
    default: false
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockoutUntil: Date,
  lastActivity: Date,
  sessionTokens: [{
    token: String,
    createdAt: Date,
    expiresAt: Date,
    ipAddress: String,
    userAgent: String
  }],
  // Audit trail
  loginHistory: [{
    timestamp: Date,
    ipAddress: String,
    userAgent: String,
    success: Boolean
  }],
  // Permissions and access control
  accessLevel: {
    type: String,
    enum: ['read-only', 'standard', 'elevated', 'super'],
    default: 'standard'
  },
  allowedIPs: [String],
  // Security settings
  require2FA: {
    type: Boolean,
    default: false
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date
}, {
  timestamps: true
});

// Indexes
adminSchema.index({ email: 1 }, { unique: true });
adminSchema.index({ role: 1 });

// Password hashing
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method to compare password
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);