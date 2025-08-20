const Notification = require('../models/Notification');
const User = require('../models/User');

// Get user's notifications
const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, read, page = 1, limit = 20 } = req.query;

    const query = { recipient: userId };
    if (type) query.type = type;
    if (read !== undefined) query.read = read === 'true';

    const notifications = await Notification.find(query)
      .populate('sender', 'name email avatar')
      .populate('relatedItem')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(query);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error.message
    });
  }
};

// Get unread notifications
const getUnreadNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await Notification.find({ 
      recipient: userId, 
      read: false 
    })
      .populate('sender', 'name email avatar')
      .populate('relatedItem')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching unread notifications',
      error: error.message
    });
  }
};

// Get notification by ID
const getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOne({ 
      _id: id, 
      recipient: userId 
    })
      .populate('sender', 'name email avatar')
      .populate('relatedItem');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching notification',
      error: error.message
    });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
      error: error.message
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.updateMany(
      { recipient: userId, read: false },
      { read: true, readAt: new Date() }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking notifications as read',
      error: error.message
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndDelete({ 
      _id: id, 
      recipient: userId 
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting notification',
      error: error.message
    });
  }
};

// Clear all notifications
const clearAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.deleteMany({ recipient: userId });

    res.json({
      success: true,
      message: 'All notifications cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error clearing notifications',
      error: error.message
    });
  }
};

// Get notification preferences
const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('notificationPreferences');

    const preferences = user.notificationPreferences || {
      email: {
        booking: true,
        payment: true,
        review: true,
        message: true,
        promotion: false
      },
      push: {
        booking: true,
        payment: true,
        review: true,
        message: true,
        promotion: false
      },
      sms: {
        booking: false,
        payment: false,
        review: false,
        message: false,
        promotion: false
      }
    };

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching notification preferences',
      error: error.message
    });
  }
};

// Update notification preferences
const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, push, sms } = req.body;

    const updateData = {};
    if (email) updateData['notificationPreferences.email'] = email;
    if (push) updateData['notificationPreferences.push'] = push;
    if (sms) updateData['notificationPreferences.sms'] = sms;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('notificationPreferences');

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: user.notificationPreferences
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating notification preferences',
      error: error.message
    });
  }
};

// Get notification types
const getNotificationTypes = async (req, res) => {
  try {
    const types = [
      {
        id: 'booking',
        name: 'Booking Notifications',
        description: 'Updates about your bookings and reservations'
      },
      {
        id: 'payment',
        name: 'Payment Notifications',
        description: 'Payment confirmations and refund updates'
      },
      {
        id: 'review',
        name: 'Review Notifications',
        description: 'New reviews and rating updates'
      },
      {
        id: 'message',
        name: 'Message Notifications',
        description: 'New messages from hosts and guests'
      },
      {
        id: 'promotion',
        name: 'Promotional Notifications',
        description: 'Special offers and promotional content'
      }
    ];

    res.json({
      success: true,
      data: types
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching notification types',
      error: error.message
    });
  }
};

// Subscribe to notification type
const subscribeToNotification = async (req, res) => {
  try {
    const { type } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user.notificationPreferences) {
      user.notificationPreferences = {
        email: {},
        push: {},
        sms: {}
      };
    }

    // Enable all channels for this notification type
    user.notificationPreferences.email[type] = true;
    user.notificationPreferences.push[type] = true;
    user.notificationPreferences.sms[type] = false; // SMS off by default

    await user.save();

    res.json({
      success: true,
      message: `Subscribed to ${type} notifications`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error subscribing to notification',
      error: error.message
    });
  }
};

// Unsubscribe from notification type
const unsubscribeFromNotification = async (req, res) => {
  try {
    const { type } = req.params;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (user.notificationPreferences) {
      user.notificationPreferences.email[type] = false;
      user.notificationPreferences.push[type] = false;
      user.notificationPreferences.sms[type] = false;
      await user.save();
    }

    res.json({
      success: true,
      message: `Unsubscribed from ${type} notifications`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error unsubscribing from notification',
      error: error.message
    });
  }
};

// Update push token
const updatePushToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    const userId = req.user.id;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        pushToken: token,
        pushPlatform: platform,
        pushTokenUpdatedAt: new Date()
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Push token updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating push token',
      error: error.message
    });
  }
};

// Remove push token
const removePushToken = async (req, res) => {
  try {
    const userId = req.user.id;

    await User.findByIdAndUpdate(userId, {
      pushToken: null,
      pushPlatform: null,
      pushTokenUpdatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Push token removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error removing push token',
      error: error.message
    });
  }
};

// Admin: Send notification to specific user
const sendNotification = async (req, res) => {
  try {
    const { recipientId, title, message, type, data } = req.body;

    const notification = new Notification({
      recipient: recipientId,
      title,
      message,
      type: type || 'admin',
      data: data || {},
      sender: req.user.id
    });

    await notification.save();
    await notification.populate('recipient', 'name email');

    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error sending notification',
      error: error.message
    });
  }
};

// Admin: Broadcast notification to all users
const broadcastNotification = async (req, res) => {
  try {
    const { title, message, type, data, filters } = req.body;

    // Build query based on filters
    let userQuery = {};
    if (filters) {
      if (filters.role) userQuery.role = filters.role;
      if (filters.verified) userQuery.isVerified = filters.verified;
      if (filters.active) userQuery.isActive = filters.active;
    }

    const users = await User.find(userQuery).select('_id');
    const userIds = users.map(user => user._id);

    // Create notifications for all users
    const notifications = userIds.map(userId => ({
      recipient: userId,
      title,
      message,
      type: type || 'broadcast',
      data: data || {},
      sender: req.user.id
    }));

    await Notification.insertMany(notifications);

    res.status(201).json({
      success: true,
      message: `Notification broadcasted to ${userIds.length} users`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error broadcasting notification',
      error: error.message
    });
  }
};

// Admin: Get sent notifications
const getSentNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const notifications = await Notification.find({ sender: req.user.id })
      .populate('recipient', 'name email')
      .populate('relatedItem')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments({ sender: req.user.id });

    res.json({
      success: true,
      data: notifications,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching sent notifications',
      error: error.message
    });
  }
};

module.exports = {
  getMyNotifications,
  getUnreadNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  getNotificationTypes,
  subscribeToNotification,
  unsubscribeFromNotification,
  updatePushToken,
  removePushToken,
  sendNotification,
  broadcastNotification,
  getSentNotifications
}; 