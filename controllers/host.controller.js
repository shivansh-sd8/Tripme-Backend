// controllers/host.controller.js
const Host = require('../models/Host');
const User = require('../models/User');

// @desc    Get host profile by ID
// @route   GET /api/hosts/:id
const getHostProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const host = await Host.findOne({ user: id })
      .populate('user', 'name email profileImage phone location bio languages')
      .populate('savedListings', 'title images pricing');

    if (!host) {
      return res.status(404).json({
        success: false,
        message: 'Host profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: host.user._id,
        name: host.user.name,
        email: host.user.email,
        profileImage: host.user.profileImage,
        bio: host.user.bio,
        location: host.user.location,
        languages: host.user.languages,
        phone: host.user.phone,
        rating: host.rating,
        reviewCount: host.reviewCount,
        responseRate: host.responseRate,
        responseTime: host.responseTime,
        isSuperhost: host.isSuperhost,
        createdAt: host.hostingSince,
        listings: host.savedListings || []
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

module.exports = {
  getHostProfile
};