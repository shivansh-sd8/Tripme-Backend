const Availability = require('../models/Availability');
const Property = require('../models/Property');

// @desc    Cleanup expired blocked availability (runs automatically)
// @route   Internal function (called by scheduler)
// @access  Private
const cleanupExpiredBlockedAvailability = async () => {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    // Find all blocked availability records that are older than 15 minutes
    // and haven't been confirmed as booked
    const expiredBlockedRecords = await Availability.find({
      status: 'blocked',
      blockedAt: { $lt: fifteenMinutesAgo }
    });
    
    if (expiredBlockedRecords.length === 0) {
      return { cleaned: 0, message: 'No expired records to clean' };
    }
    
    // Update all expired blocked records to 'available' status
    const result = await Availability.updateMany(
      {
        status: 'blocked',
        blockedAt: { $lt: fifteenMinutesAgo }
      },
      {
        $set: {
          status: 'available',
          reason: null
        },
        $unset: {
          blockedBy: 1,
          blockedAt: 1
        }
      }
    );
    
    return {
      cleaned: result.modifiedCount,
      message: `Cleaned up ${result.modifiedCount} expired blocked availability records`
    };
    
  } catch (error) {
    console.error('❌ Error during availability cleanup:', error);
    throw error;
  }
};

// @desc    Get property availability
// @route   GET /api/availability/:propertyId
// @access  Public
const getPropertyAvailability = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    let query = { property: propertyId };

    // If date range is provided, filter by dates
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      query.date = { $gte: start, $lte: end };
    }

    const availability = await Availability.find(query)
      .sort({ date: 1 })
      .populate('bookedBy', 'status');

    res.status(200).json({
      success: true,
      data: { availability }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching availability',
      error: error.message
    });
  }
};

// @desc    Get availability for a date range
// @route   GET /api/availability/:propertyId/range
// @access  Public
const getAvailabilityRange = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }

    // Validate property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    const availability = await Availability.find({
      property: propertyId,
      date: { $gte: start, $lte: end }
    }).sort({ date: 1 });

    res.status(200).json({
      success: true,
      data: { availability }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching availability range',
      error: error.message
    });
  }
};

// @desc    Create availability entry
// @route   POST /api/availability/:propertyId
// @access  Private (Host only)
const createAvailability = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { date, status, reason } = req.body;

    // Check if user is the host of this property
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Allow users to update availability for booking purposes (on-hold, booked, available, blocked)
    // but restrict other operations to property hosts only
    if (property.host.toString() !== req.user._id.toString()) {
      // Check if this is a booking-related status update
      if (status && ['on-hold', 'booked', 'available', 'blocked'].includes(status)) {
        // Allow booking-related status updates for any authenticated user
        // This enables the booking flow to work properly
      } else {
        return res.status(403).json({
          success: false,
          message: 'You can only manage availability for your own properties'
        });
      }
    }

    // Check if availability already exists for this date
    const existingAvailability = await Availability.findOne({
      property: propertyId,
      date: new Date(date)
    });

    if (existingAvailability) {
      return res.status(400).json({
        success: false,
        message: 'Availability already exists for this date'
      });
    }

    const availability = await Availability.create({
      property: propertyId,
      date: new Date(date),
      status: status || 'available',
      reason: reason || null
    });

    res.status(201).json({
      success: true,
      message: 'Availability created successfully',
      data: { availability }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating availability',
      error: error.message
    });
  }
};

// @desc    Update availability entry
// @route   PUT /api/availability/:propertyId/:availabilityId
// @access  Private (Host only)
const updateAvailability = async (req, res) => {
  try {
    const { propertyId, availabilityId } = req.params;
    const { date, status, reason } = req.body;

    // Check if user is the host of this property
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Allow users to update availability for booking purposes (on-hold, booked, available, blocked)
    // but restrict other operations to property hosts only
    if (property.host.toString() !== req.user._id.toString()) {
      // Check if this is a booking-related status update
      if (status && ['on-hold', 'booked', 'available', 'blocked'].includes(status)) {
        // Allow booking-related status updates for any authenticated user
        // This enables the booking flow to work properly
      } else {
        return res.status(403).json({
          success: false,
          message: 'You can only manage availability for your own properties'
        });
      }
    }

    // If availabilityId is undefined or invalid, create a new availability record
    if (!availabilityId || availabilityId === 'undefined') {
      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'Date is required when creating new availability'
        });
      }

      // Check if availability already exists for this date
      const existingAvailability = await Availability.findOne({
        property: propertyId,
        date: new Date(date)
      });

      if (existingAvailability) {
        // Update existing record
        existingAvailability.status = status || 'available';
        existingAvailability.reason = reason || null;
        await existingAvailability.save();

        return res.status(200).json({
          success: true,
          message: 'Availability updated successfully',
          data: { availability: existingAvailability }
        });
      } else {
        // Create new record
        const newAvailability = await Availability.create({
          property: propertyId,
          date: new Date(date),
          status: status || 'available',
          reason: reason || null
        });

        return res.status(201).json({
          success: true,
          message: 'Availability created successfully',
          data: { availability: newAvailability }
        });
      }
    }

    // Handle case where we have a valid availabilityId
    else {
      const availability = await Availability.findById(availabilityId);
      if (!availability) {
        return res.status(404).json({
          success: false,
          message: 'Availability entry not found'
        });
      }

      if (availability.property.toString() !== propertyId) {
        return res.status(400).json({
          success: false,
          message: 'Availability entry does not belong to this property'
        });
      }

      availability.status = status || availability.status;
      availability.reason = reason || availability.reason;
      await availability.save();

      res.status(200).json({
        success: true,
        message: 'Availability updated successfully',
        data: { availability }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating availability',
      error: error.message
    });
  }
};

// @desc    Delete availability entry
// @route   DELETE /api/availability/:propertyId/:availabilityId
// @access  Private (Host only)
const deleteAvailability = async (req, res) => {
  try {
    const { propertyId, availabilityId } = req.params;

    // Check if user is the host of this property
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    if (property.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage availability for your own properties'
      });
    }

    const availability = await Availability.findById(availabilityId);
    if (!availability) {
      return res.status(404).json({
        success: false,
        message: 'Availability entry not found'
      });
    }

    if (availability.property.toString() !== propertyId) {
      return res.status(400).json({
        success: false,
        message: 'Availability entry does not belong to this property'
      });
    }

    await Availability.findByIdAndDelete(availabilityId);

    res.status(200).json({
      success: true,
      message: 'Availability deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting availability',
      error: error.message
    });
  }
};

// @desc    Bulk update availability
// @route   POST /api/availability/:propertyId/bulk
// @access  Private (Host only)
const bulkUpdateAvailability = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { updates } = req.body; // Array of { date, status, reason }

    // Check if user is the host of this property
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    if (property.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage availability for your own properties'
      });
    }

    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: { property: propertyId, date: new Date(update.date) },
        update: { $set: { status: update.status, reason: update.reason } },
        upsert: true
      }
    }));

    const result = await Availability.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: 'Bulk availability update completed',
      data: { result }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating availability in bulk',
      error: error.message
    });
  }
};

// @desc    Block specific dates
// @route   POST /api/availability/:propertyId/block-dates
// @access  Private (Host only)
const blockDates = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { dates, reason } = req.body; // Array of dates

    // Check if user is the host of this property
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    if (property.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage availability for your own properties'
      });
    }

    const bulkOps = dates.map(date => ({
      updateOne: {
        filter: { property: propertyId, date: new Date(date) },
        update: { $set: { status: 'blocked', reason: reason || 'Host blocked' } },
        upsert: true
      }
    }));

    const result = await Availability.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: 'Dates blocked successfully',
      data: { result }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error blocking dates',
      error: error.message
    });
  }
};

// @desc    Unblock specific dates
// @route   POST /api/availability/:propertyId/unblock-dates
// @access  Private (Host only)
const unblockDates = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { dates } = req.body; // Array of dates

    // Check if user is the host of this property
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    if (property.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage availability for your own properties'
      });
    }

    const result = await Availability.updateMany(
      { property: propertyId, date: { $in: dates.map(d => new Date(d)) } },
      { $set: { status: 'available', reason: null } }
    );

    res.status(200).json({
      success: true,
      message: 'Dates unblocked successfully',
      data: { result }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error unblocking dates',
      error: error.message
    });
  }
};

// @desc    Block dates for booking (temporary reservation)
// @route   PUT /api/availability/:propertyId/block-booking
// @access  Private (Any authenticated user)
const blockDatesForBooking = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { dates } = req.body; // Array of dates
    const userId = req.user._id; // Get user ID from authenticated request



    // Validate property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Validate dates array
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid dates array is required'
      });
    }

    // Any authenticated user can block dates for booking
    const bulkOps = dates.map(date => ({
      updateOne: {
        filter: { property: propertyId, date: new Date(date) },
        update: { 
          $set: { 
            status: 'blocked', 
            reason: 'Temporarily reserved for booking',
            blockedBy: userId,
            blockedAt: new Date()
          } 
        },
        upsert: true
      }
    }));

    const result = await Availability.bulkWrite(bulkOps);



    res.status(200).json({
      success: true,
      message: 'Dates blocked for booking',
      data: { 
        blockedDates: dates.length,
        result 
      }
    });
  } catch (error) {
    console.error('❌ Error blocking dates for booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error blocking dates for booking',
      error: error.message
    });
  }
};

// @desc    Confirm booking (change status to booked)
// @route   PUT /api/availability/:propertyId/confirm-booking
// @access  Private (Any authenticated user)
const confirmBooking = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { dates, bookingId } = req.body; // Array of dates and booking ID
    const userId = req.user._id; // Get user ID from authenticated request



    // Validate property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Validate dates array
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid dates array is required'
      });
    }

    // Note: bookingId is optional - can be used to link availability to a specific booking

    // Check if all dates are currently blocked by this user
    const blockedDates = await Availability.find({
      property: propertyId,
      date: { $in: dates.map(d => new Date(d)) },
      blockedBy: userId,
      status: 'blocked'
    });

    if (blockedDates.length !== dates.length) {
      return res.status(400).json({
        success: false,
        message: 'Some dates are not blocked by you or are not available for confirmation',
        blockedCount: blockedDates.length,
        requestedCount: dates.length
      });
    }

    // Confirm the booking by updating status to booked and linking to the booking
    const result = await Availability.updateMany(
      { 
        property: propertyId, 
        date: { $in: dates.map(d => new Date(d)) },
        blockedBy: userId,
        status: 'blocked'
      },
      { 
        $set: { 
          status: 'booked', 
          reason: 'Confirmed booking',
          bookedBy: bookingId || null,
          bookedAt: new Date()
        },
        $unset: { blockedBy: 1, blockedAt: 1 }
      }
    );



    res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: { 
        confirmedDates: dates.length,
        result 
      }
    });
  } catch (error) {
    console.error('❌ Error confirming booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming booking',
      error: error.message
    });
  }
};

// @desc    Manual cleanup of expired blocked availability (for testing/admin)
// @route   POST /api/availability/cleanup
// @access  Private (Admin only)
const manualCleanup = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can perform manual cleanup'
      });
    }

    const result = await cleanupExpiredBlockedAvailability();
    
    res.status(200).json({
      success: true,
      message: 'Manual cleanup completed',
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error during manual cleanup',
      error: error.message
    });
  }
};

// @desc    Update availability status (utility function for other controllers)
// @access  Private (Internal use)
const updateAvailabilityStatus = async (bookingId, status) => {
  try {
    // Find the booking to get property and dates
    const booking = await require('../models/Booking').findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Update availability status for the booking dates
    const result = await Availability.updateMany(
      { 
        property: booking.property,
        date: { $in: booking.dates },
        status: { $in: ['blocked', 'booked'] }
      },
      { 
        $set: { 
          status: status,
          reason: status === 'booked' ? 'Confirmed booking' : 'Available for booking'
        },
        $unset: status === 'available' ? { blockedBy: 1, blockedAt: 1, bookedBy: 1, bookedAt: 1 } : {}
      }
    );

    return result;
  } catch (error) {
    console.error('❌ Error updating availability status:', error);
    throw error;
  }
};

// @desc    Release blocked dates (payment failed or user cancelled)
// @route   PUT /api/availability/:propertyId/release-dates
// @access  Private (Any authenticated user)
const releaseDates = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { dates } = req.body; // Array of dates
    const userId = req.user._id; // Get user ID from authenticated request



    // Validate property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Validate dates array
    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid dates array is required'
      });
    }

    // Check if all dates are currently blocked by this user
    const blockedDates = await Availability.find({
      property: propertyId,
      date: { $in: dates.map(d => new Date(d)) },
      blockedBy: userId,
      status: 'blocked'
    });

    if (blockedDates.length !== dates.length) {
      return res.status(400).json({
        success: false,
        message: 'Some dates are not blocked by you or are not available for release',
        blockedCount: blockedDates.length,
        requestedCount: dates.length
      });
    }

    // Release the blocked dates
    const result = await Availability.updateMany(
      { 
        property: propertyId, 
        date: { $in: dates.map(d => new Date(d)) },
        blockedBy: userId,
        status: 'blocked'
      },
      { 
        $set: { 
          status: 'available', 
          reason: null
        },
        $unset: { blockedBy: 1, blockedAt: 1 }
      }
    );



    res.status(200).json({
      success: true,
      message: 'Dates released successfully',
      data: { 
        releasedDates: dates.length,
        result 
      }
    });
  } catch (error) {
    console.error('❌ Error releasing dates:', error);
    res.status(500).json({
      success: false,
      message: 'Error releasing dates',
      error: error.message
    });
  }
};

module.exports = {
  getPropertyAvailability,
  getAvailabilityRange,
  createAvailability,
  updateAvailability,
  deleteAvailability,
  bulkUpdateAvailability,
  blockDates,
  unblockDates,
  blockDatesForBooking,
  confirmBooking,
  releaseDates,
  cleanupExpiredBlockedAvailability,
  manualCleanup,
  updateAvailabilityStatus
};
