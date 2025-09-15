const Property = require('../models/Property');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Wishlist = require('../models/Wishlist');
const slugify = require('slugify');

// Helper function to transform listing data for frontend
const transformListingForFrontend = (listing) => {
  const transformed = listing.toObject ? listing.toObject() : listing;
  
  // Transform images to match frontend expectations
  const imageUrls = transformed.images?.map(img => img.url) || [];
  
  return {
    ...transformed,
    // For StayCard component (expects string array)
    images: imageUrls,
    // For Property component (expects object array)
    propertyImages: transformed.images || [],
    // Transform pricing for frontend
    price: {
      amount: transformed.pricing?.basePrice || 0,
      currency: transformed.pricing?.currency || 'INR'
    },
    // Add rating info if not present
    rating: transformed.rating?.average || 0,
    reviewCount: transformed.reviewCount || 0,
    // Add tags based on amenities and features
    tags: [
      ...(transformed.amenities || []).slice(0, 3),
      ...(transformed.features || []).slice(0, 2)
    ],
    // Add instant bookable flag
    instantBookable: false
  };
};

// @desc    Create new property listing
// @route   POST /api/listings
// @access  Private (Hosts only)
const createListing = async (req, res) => {
  try {
    const {
      title,
      description,
      location,
      type,
      propertyType,
      style,
      pricing,
      amenities,
      features,
      maxGuests,
      minNights,
      bedrooms,
      beds,
      bathrooms,
      houseRules,
      checkInTime,
      checkOutTime,
      cancellationPolicy,
      images
    } = req.body;

    // Check if user is a host
    if (req.user.role !== 'host' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only hosts can create listings'
      });
    }

    // Validate required fields
    if (!title || !description || !location || !type || !pricing) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Generate slug
    const slug = slugify(title, { lower: true });

    // Transform images if they are strings to objects
    let transformedImages = images || [];
    if (Array.isArray(transformedImages)) {
      transformedImages = transformedImages.map((image, index) => {
        if (typeof image === 'string') {
          // If image is a string (URL), convert to object format
          return {
            url: image,
            publicId: `temp_${Date.now()}_${index}`, // Generate temporary publicId
            isPrimary: index === 0, // First image is primary
            caption: '',
            width: 0,
            height: 0,
            format: 'jpg',
            size: 0
          };
        }
        return image; // If already an object, keep as is
      });
    }

    // Create listing data object
    const listingData = {
      title,
      description,
      host: req.user.id,
      location,
      type,
      propertyType: propertyType || 'standard',
      style: style || 'modern',
      pricing,
      amenities: amenities || [],
      features: features || [],
      maxGuests,
      minNights: minNights || 1,
      bedrooms,
      beds,
      bathrooms,
      houseRules: houseRules || [],
      checkInTime: checkInTime || '15:00',
      checkOutTime: checkOutTime || '11:00',
      cancellationPolicy: cancellationPolicy || 'moderate',
      images: transformedImages,
      seo: {
        slug
      }
    };

    const listing = await Property.create(listingData);

    res.status(201).json({
      success: true,
      message: 'Listing created successfully',
      data: { listing: transformListingForFrontend(listing) }
    });
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating listing',
      error: error.message
    });
  }
};

// @desc    Get all listings with filters
// @route   GET /api/listings
// @access  Public
const getListings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      type,
      minPrice,
      maxPrice,
      guests,
      amenities,
      location,
      checkIn,
      checkOut,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { status: 'published' };

    // Search by title or description
    if (search) {
      query.$text = { $search: search };
    }

    // Filter by property type
    if (type) {
      query.type = { $in: type.split(',') };
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      query['pricing.basePrice'] = {};
      if (minPrice) query['pricing.basePrice'].$gte = Number(minPrice);
      if (maxPrice) query['pricing.basePrice'].$lte = Number(maxPrice);
    }

    // Filter by number of guests
    if (guests) {
      query.maxGuests = { $gte: Number(guests) };
    }

    // Filter by amenities
    if (amenities) {
      query.amenities = { $all: amenities.split(',') };
    }

    // Filter by location (nearby search)
    if (location && location.coordinates) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [Number(location.coordinates[0]), Number(location.coordinates[1])]
          },
          $maxDistance: location.radius || 50000 // Default 50km
        }
      };
    }
    // Filter strictly by city if provided
    if (location && location.city) {
      query['location.city'] = location.city;
    }
    
    // Also check for location.city as a direct query parameter
    if (req.query['location.city']) {
      query['location.city'] = req.query['location.city'];
    }
    
    // Support both city and location.city parameters for backward compatibility
    if (req.query.city) {
      query['location.city'] = req.query.city;
    }



    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const listings = await Property.find(query)
      .populate('host', 'name profileImage rating')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Property.countDocuments(query);

    // Transform listings for frontend
    const transformedListings = listings.map(transformListingForFrontend);

    res.status(200).json({
      success: true,
      data: {
        listings: transformedListings,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching listings',
      error: error.message
    });
  }
};

// @desc    Get single listing by ID or slug
// @route   GET /api/listings/:id
// @access  Public
const getListing = async (req, res) => {
  try {
    const { id } = req.params;

    let listing;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // Search by ObjectId
      listing = await Property.findById(id)
        .populate('host', 'name profileImage bio rating reviewCount email phone location languages createdAt')
        .populate({
          path: 'reviews',
          populate: {
            path: 'reviewer',
            select: 'name profileImage'
          },
          options: { limit: 10 }
        });
    } else {
      // Search by slug
      listing = await Property.findOne({ 'seo.slug': id })
        .populate('host', 'name profileImage bio rating reviewCount email phone location languages createdAt')
        .populate({
          path: 'reviews',
          populate: {
            path: 'reviewer',
            select: 'name profileImage'
          },
          options: { limit: 10 }
        });
    }

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Check if user has this in wishlist
    let isWishlisted = false;
    if (req.user) {
      const wishlistItem = await Wishlist.findOne({
        user: req.user.id,
        listing: listing._id
      });
      isWishlisted = !!wishlistItem;
    }

    // Check if this is a request for editing (by checking if user is the host)
    const isForEditing = req.user && listing.host && listing.host.toString() === req.user.id;
    
    let responseData;
    if (isForEditing) {
      const listingObj = listing.toObject();
      // Ensure images have the correct structure for editing
      if (listingObj.images && Array.isArray(listingObj.images)) {
        listingObj.images = listingObj.images.map((image, index) => ({
          url: image.url,
          publicId: image.publicId,
          isPrimary: image.isPrimary || index === 0, // Ensure isPrimary is set
          caption: image.caption || '',
          width: image.width || 0,
          height: image.height || 0,
          format: image.format || 'jpg',
          size: image.size || 0
        }));
      }
      responseData = listingObj;
    } else {
      responseData = transformListingForFrontend(listing);
    }
    

    
    res.status(200).json({
      success: true,
      data: {
        listing: {
          ...responseData,
          isWishlisted
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching listing',
      error: error.message
    });
  }
};

// @desc    Update listing
// @route   PUT /api/listings/:id
// @access  Private (Host/Owner only)
const updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const listing = await Property.findById(id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Check if user is the host or admin
    if (listing.host && listing.host.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this listing'
      });
    }

    // Transform images if they are strings to objects
    if (updateData.images && Array.isArray(updateData.images)) {
      updateData.images = updateData.images.map((image, index) => {
        if (typeof image === 'string') {
          // If image is a string (URL), convert to object format
          return {
            url: image,
            publicId: `temp_${Date.now()}_${index}`, // Generate temporary publicId
            isPrimary: index === 0, // First image is primary
            caption: '',
            width: 0,
            height: 0,
            format: 'jpg',
            size: 0
          };
        }
        return image; // If already an object, keep as is
      });
    }

    // Generate new slug if title is updated
    if (updateData.title && updateData.title !== listing.title) {
      updateData.seo = {
        ...updateData.seo,
        slug: slugify(updateData.title, { lower: true })
      };
    }

    const updatedListing = await Property.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('host', 'name profileImage');

    res.status(200).json({
      success: true,
      message: 'Listing updated successfully',
      data: { listing: transformListingForFrontend(updatedListing) }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating listing',
      error: error.message
    });
  }
};

// @desc    Delete listing
// @route   DELETE /api/listings/:id
// @access  Private (Host/Owner only)
const deleteListing = async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await Property.findById(id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Check if user is the host or admin
    if (listing.host && listing.host.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this listing'
      });
    }

    // Check if there are any active bookings
    const activeBookings = await Booking.find({
      listing: id,
      status: { $in: ['confirmed', 'pending'] }
    });

    if (activeBookings.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete listing with active bookings'
      });
    }

    // Soft delete by changing status
    await Property.findByIdAndUpdate(id, { status: 'deleted' });

    res.status(200).json({
      success: true,
      message: 'Listing deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting listing',
      error: error.message
    });
  }
};

// @desc    Get user's listings
// @route   GET /api/listings/my-listings
// @access  Private
const getMyListings = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = { host: req.user.id };
    if (status) {
      query.status = status;
    }

    const listings = await Property.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Property.countDocuments(query);

    // Transform listings for frontend
    const transformedListings = listings.map(transformListingForFrontend);

    res.status(200).json({
      success: true,
      data: {
        listings: transformedListings,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching your listings',
      error: error.message
    });
  }
};





// @desc    Add listing to wishlist
// @route   POST /api/listings/:id/wishlist
// @access  Private
const addToWishlist = async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await Property.findById(id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    const existingWishlist = await Wishlist.findOne({
      user: req.user.id,
      listing: id
    });

    if (existingWishlist) {
      return res.status(400).json({
        success: false,
        message: 'Listing already in wishlist'
      });
    }

    await Wishlist.create({
      user: req.user.id,
      listing: id
    });

    res.status(200).json({
      success: true,
      message: 'Added to wishlist successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding to wishlist',
      error: error.message
    });
  }
};

// @desc    Remove listing from wishlist
// @route   DELETE /api/listings/:id/wishlist
// @access  Private
const removeFromWishlist = async (req, res) => {
  try {
    const { id } = req.params;

    await Wishlist.findOneAndDelete({
      user: req.user.id,
      listing: id
    });

    res.status(200).json({
      success: true,
      message: 'Removed from wishlist successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error removing from wishlist',
      error: error.message
    });
  }
};

// @desc    Publish listing
// @route   POST /api/listings/:id/publish
// @access  Private (Host/Owner only)
const publishListing = async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await Property.findById(id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Check if user is the host or admin
    if (listing.host && listing.host.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to publish this listing'
      });
    }

    // Check if listing is already published
    if (listing.status === 'published') {
      return res.status(400).json({
        success: false,
        message: 'Listing is already published'
      });
    }

    // Publish the listing
    listing.status = 'published';
    listing.isDraft = false;
    
    await listing.save();

    res.status(200).json({
      success: true,
      message: 'Listing published successfully',
      data: { listing: transformListingForFrontend(listing) }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error publishing listing',
      error: error.message
    });
  }
};

// @desc    Unpublish listing
// @route   POST /api/listings/:id/unpublish
// @access  Private (Host/Owner only)
const unpublishListing = async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await Property.findById(id);

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    // Check if user is the host or admin
    if (listing.host && listing.host.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to unpublish this listing'
      });
    }

    // Check if listing is already unpublished
    if (listing.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Listing is not published'
      });
    }

    // Unpublish the listing
    listing.status = 'draft';
    listing.isDraft = true;
    
    await listing.save();

    res.status(200).json({
      success: true,
      message: 'Listing unpublished successfully',
      data: { listing: transformListingForFrontend(listing) }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error unpublishing listing',
      error: error.message
    });
  }
};

// @desc    Get featured listings
// @route   GET /api/listings/featured
// @access  Public
const getFeaturedListings = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const listings = await Property.find({
      status: 'published',
      isFeatured: true
    })
      .populate('host', 'name profileImage')
      .sort({ rating: -1, reviewCount: -1 })
      .limit(Number(limit));

    // Transform featured listings for frontend
    const transformedFeaturedListings = listings.map(transformListingForFrontend);

    res.status(200).json({
      success: true,
      data: { listings: transformedFeaturedListings }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching featured listings',
      error: error.message
    });
  }
};

// @desc    Get similar listings
// @route   GET /api/listings/:id/similar
// @access  Public
const getSimilarListings = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 4 } = req.query;

    const listing = await Property.findById(id);
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }

    const similarListings = await Property.find({
      _id: { $ne: id },
      status: 'published',
      type: listing.type,
      'location.city': listing.location.city
    })
      .populate('host', 'name profileImage')
      .sort({ rating: -1 })
      .limit(Number(limit));

    // Transform similar listings for frontend
    const transformedSimilarListings = similarListings.map(transformListingForFrontend);

    res.status(200).json({
      success: true,
      data: { listings: transformedSimilarListings }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching similar listings',
      error: error.message
    });
  }
};

module.exports = {
  createListing,
  getListings,
  getListing,
  updateListing,
  deleteListing,
  getMyListings,
  addToWishlist,
  removeFromWishlist,
  getFeaturedListings,
  getSimilarListings,
  publishListing,
  unpublishListing
};

// --- STUBS FOR UNIMPLEMENTED ROUTE HANDLERS ---
// Only add stubs for methods that don't exist in module.exports
const notImplemented = (name) => (req, res) => res.status(501).json({ success: false, message: `${name} not implemented yet` });

// List of all referenced route handlers in listing.routes.js that need stubs
const stubMethods = [
  'getAllListings',
  'searchListings',
  'getListingCategories',
  'getPopularLocations',
  'uploadPhotos',
  'deletePhoto',
  'setPrimaryPhoto',
  'updatePricing',
  'updateListingStatus',
  'updateListingVisibility',
  'getListingReviews',
  'getListingRating',
  'getWishlistedListings',
  'getListingStats',
  'getListingRevenue',
  'getListingViews',
  'getHostDashboard',
  'getHostPerformance',
  'getPendingListings',
  'approveListing',
  'rejectListing',
  'featureListing'
];
stubMethods.forEach((name) => {
  if (!module.exports[name]) {
    module.exports[name] = notImplemented(name);
  }
});
