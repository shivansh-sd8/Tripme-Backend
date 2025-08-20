const Wishlist = require('../models/Wishlist');
const Property = require('../models/Property');
const Service = require('../models/Service');
const User = require('../models/User');

// Helper for dynamic population
const populateWishlistItems = {
  path: 'items.itemId',
  select: 'title images price location category description',
  model: function(doc) {
    return doc.itemType === 'property' ? 'Property' : 'Service';
  }
};

// Get user's wishlists
const getMyWishlists = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const wishlists = await Wishlist.find({ 
      $or: [
        { user: userId },
        { collaborators: userId }
      ]
    })
      .populate('user', 'name email avatar')
      .populate('collaborators', 'name email avatar')
      .populate(populateWishlistItems)
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Wishlist.countDocuments({
      $or: [
        { user: userId },
        { collaborators: userId }
      ]
    });

    res.json({
      success: true,
      data: wishlists,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching wishlists',
      error: error.message
    });
  }
};

// Create new wishlist
const createWishlist = async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const userId = req.user.id;

    const wishlist = await Wishlist.create({
      user: userId,
      name,
      description,
      isPublic: isPublic || false
    });

    await wishlist.populate('user', 'name email avatar');

    res.status(201).json({
      success: true,
      message: 'Wishlist created successfully',
      data: wishlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating wishlist',
      error: error.message
    });
  }
};

// Get wishlist by ID
const getWishlistById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const wishlist = await Wishlist.findOne({
      _id: id,
      $or: [
        { user: userId },
        { collaborators: userId },
        { isPublic: true }
      ]
    })
      .populate('user', 'name email avatar')
      .populate('collaborators', 'name email avatar')
      .populate(populateWishlistItems);

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    res.json({
      success: true,
      data: wishlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching wishlist',
      error: error.message
    });
  }
};

// Update wishlist
const updateWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isPublic } = req.body;
    const userId = req.user.id;

    const wishlist = await Wishlist.findOneAndUpdate(
      {
        _id: id,
        user: userId
      },
      {
        name,
        description,
        isPublic
      },
      { new: true }
    )
      .populate('user', 'name email avatar')
      .populate('collaborators', 'name email avatar')
      .populate(populateWishlistItems);

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    res.json({
      success: true,
      message: 'Wishlist updated successfully',
      data: wishlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating wishlist',
      error: error.message
    });
  }
};

// Delete wishlist
const deleteWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const wishlist = await Wishlist.findOneAndDelete({
      _id: id,
      user: userId
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    res.json({
      success: true,
      message: 'Wishlist deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting wishlist',
      error: error.message
    });
  }
};

// Add item to wishlist
const addToWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemType, itemId, notes } = req.body;
    const userId = req.user.id;

    const wishlist = await Wishlist.findOne({
      _id: id,
      $or: [
        { user: userId },
        { collaborators: userId }
      ]
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Check if item already exists in wishlist
    const existingItem = wishlist.items.find(item => 
      item.itemType === itemType && item.itemId.toString() === itemId
    );

    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Item already exists in wishlist'
      });
    }

    // Verify item exists
    let itemExists = false;
    if (itemType === 'property') {
      itemExists = await Property.findById(itemId);
    } else if (itemType === 'service') {
      itemExists = await Service.findById(itemId);
    }

    if (!itemExists) {
      return res.status(404).json({
        success: false,
        message: `${itemType} not found`
      });
    }

    wishlist.items.push({
      itemType,
      itemId,
      notes,
      addedBy: userId,
      addedAt: new Date()
    });

    await wishlist.save();
    await wishlist.populate(populateWishlistItems);

    res.status(201).json({
      success: true,
      message: 'Item added to wishlist successfully',
      data: wishlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding item to wishlist',
      error: error.message
    });
  }
};

// Remove item from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const userId = req.user.id;

    const wishlist = await Wishlist.findOne({
      _id: id,
      $or: [
        { user: userId },
        { collaborators: userId }
      ]
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    wishlist.items = wishlist.items.filter(item => 
      item._id.toString() !== itemId
    );

    await wishlist.save();
    await wishlist.populate(populateWishlistItems);

    res.json({
      success: true,
      message: 'Item removed from wishlist successfully',
      data: wishlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error removing item from wishlist',
      error: error.message
    });
  }
};

// Share wishlist
const shareWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const wishlist = await Wishlist.findOne({
      _id: id,
      user: userId
    });

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    if (!wishlist.isPublic) {
      wishlist.isPublic = true;
      await wishlist.save();
    }

    res.json({
      success: true,
      message: 'Wishlist shared successfully',
      data: {
        shareId: wishlist.shareId,
        shareUrl: `${process.env.FRONTEND_URL}/wishlist/shared/${wishlist.shareId}`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error sharing wishlist',
      error: error.message
    });
  }
};

// Get shared wishlist
const getSharedWishlist = async (req, res) => {
  try {
    const { shareId } = req.params;

    const wishlist = await Wishlist.findOne({
      shareId,
      isPublic: true
    })
      .populate('user', 'name email avatar')
      .populate('collaborators', 'name email avatar')
      .populate(populateWishlistItems);

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Shared wishlist not found'
      });
    }

    res.json({
      success: true,
      data: wishlist
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching shared wishlist',
      error: error.message
    });
  }
};

module.exports = {
  getMyWishlists,
  createWishlist,
  getWishlistById,
  updateWishlist,
  deleteWishlist,
  addToWishlist,
  removeFromWishlist,
  shareWishlist,
  getSharedWishlist
}; 