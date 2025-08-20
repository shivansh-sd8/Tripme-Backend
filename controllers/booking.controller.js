const Booking = require('../models/Booking');
const Property = require('../models/Property');
const Service = require('../models/Service');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Coupon = require('../models/Coupon');
const Availability = require('../models/Availability');

const Notification = require('../models/Notification');
const { 
  sendBookingConfirmationEmail, 
  sendNewBookingNotificationEmail, 
  sendBookingCancellationEmail,
  sendHostCancelledBookingEmail,
  sendHostConfirmedBookingEmail,
  sendHostCompletedBookingEmail,
  sendHostCheckInGuestEmail,
  sendHostStatusUpdateEmail
} = require('../utils/sendEmail');
const { generateReceipt, generateReceiptHTML } = require('../utils/generateReceipt');

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res) => {
  try {
    const {
      propertyId, // frontend may send this
      listingId, // frontend may send this
      serviceId,
      checkIn,
      checkOut,
      checkInTime,
      checkOutTime,
      timeSlot,
      guests,
      specialRequests,
      couponCode
    } = req.body;

    // Determine if this is a property or service booking
    const actualListingId = listingId || propertyId;
    let listing = null;
    let service = null;
    let host = null;
    let bookingType = '';
    let currency = 'INR';
    let cancellationPolicy = 'moderate';

    if (actualListingId && serviceId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book both listing and service in one booking'
      });
    }
    if (!actualListingId && !serviceId) {
      return res.status(400).json({ 
        success: false,
        message: 'Either listingId/propertyId or serviceId is required'
      });
    }

    // Get listing or service details
    if (actualListingId) {
      listing = await Property.findById(actualListingId);
      if (!listing) {
        return res.status(404).json({ success: false, message: 'Listing not found' });
      }
      host = await User.findById(listing.host);
      bookingType = 'property';
      currency = listing.pricing.currency || 'INR';
      cancellationPolicy = listing.cancellationPolicy || 'moderate';
    } else {
      service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({ success: false, message: 'Service not found' });
      }
      host = await User.findById(service.provider);
      bookingType = 'service';
      currency = service.pricing.currency || 'INR';
      cancellationPolicy = service.cancellationPolicy || 'moderate';
    }

    // Validate dates/times
    if (bookingType === 'property') {
      if (!checkIn || !checkOut) {
        return res.status(400).json({ success: false, message: 'Check-in and check-out dates are required for property bookings' });
      }
      
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      
      if (checkInDate >= checkOutDate) {
        return res.status(400).json({ success: false, message: 'Check-out date must be after check-in date' });
      }
      // Check minimum nights
      const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
      if (nights < listing.minNights) {
        return res.status(400).json({ success: false, message: `Minimum ${listing.minNights} nights required` });
      }
      // Note: Availability is checked separately by the availability controller
      // This ensures proper separation of concerns
    } else {
      if (!timeSlot || !timeSlot.startTime || !timeSlot.endTime) {
        return res.status(400).json({ success: false, message: 'Time slot is required for service bookings' });
      }
    }

    // Handle guests
    let guestDetails = { adults: 1, children: 0, infants: 0 };
    if (typeof guests === 'number') {
      guestDetails = { adults: guests, children: 0, infants: 0 };
    } else if (typeof guests === 'object' && guests !== null) {
      guestDetails = {
        adults: guests.adults || 1,
        children: guests.children || 0,
        infants: guests.infants || 0
      };
    }

    // Calculate total amount and fees
    let totalAmount = 0;
    let basePrice = 0;
    let extraGuestPrice = 0;
    let cleaningFee = 0;
    let serviceFee = 0;
    let securityDeposit = 0;
    let nights = 1;
    let platformFee = 0;
    let hostEarning = 0;
    
    if (bookingType === 'property') {
      basePrice = listing.pricing.basePrice;
      extraGuestPrice = listing.pricing.extraGuestPrice || 0;
      cleaningFee = listing.pricing.cleaningFee || 0;
      serviceFee = listing.pricing.serviceFee || 0;
      securityDeposit = listing.pricing.securityDeposit || 0;
      nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
      totalAmount = basePrice * nights;
      if (guestDetails.adults > 1) {
        const extraGuests = guestDetails.adults - 1;
        totalAmount += extraGuestPrice * extraGuests * nights;
      }
      totalAmount += cleaningFee + serviceFee;
    } else {
      basePrice = service.pricing.basePrice;
      serviceFee = service.pricing.serviceFee || 0;
      totalAmount = basePrice + serviceFee;
      if (guestDetails.adults > 1) {
        totalAmount += service.pricing.perPersonPrice * (guestDetails.adults - 1);
      }
    }

    // Calculate platform fees and host earnings
    const platformFeePercentage = 0.15; // 15% platform fee
    const hostEarningPercentage = 0.85; // 85% goes to host
    
    // Apply coupon if provided
    let discountAmount = 0;
    let couponApplied = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validTo: { $gte: new Date() }
      });
      if (coupon) {
        // Check if user has already used this coupon
        const hasUsed = coupon.usedBy?.some(usage => usage.user.toString() === req.user._id.toString());
        if (!hasUsed) {
          if (coupon.discountType === 'percentage') {
            discountAmount = (totalAmount * coupon.amount) / 100;
            if (coupon.maxDiscount) {
              discountAmount = Math.min(discountAmount, coupon.maxDiscount);
            }
          } else {
            discountAmount = coupon.amount;
          }
          if (coupon.minBookingAmount && totalAmount < coupon.minBookingAmount) {
            discountAmount = 0;
          }
          couponApplied = coupon._id;
        }
      }
    }
    
    // Apply discount and recalculate fees
    totalAmount -= discountAmount;
    platformFee = totalAmount * platformFeePercentage;
    hostEarning = totalAmount * hostEarningPercentage;

    // Create booking
    const booking = await Booking.create({
              user: req.user._id,
      host: host._id,
      listing: bookingType === 'property' ? actualListingId : undefined,
      service: bookingType === 'service' ? serviceId : undefined,
      bookingType,
      status: 'pending',
      checkIn: bookingType === 'property' ? checkIn : undefined,
      checkOut: bookingType === 'property' ? checkOut : undefined,
      checkInTime: checkInTime || (bookingType === 'property' ? (listing.checkInTime || '11:00') : undefined),
      checkOutTime: checkOutTime || (bookingType === 'property' ? (listing.checkOutTime || '10:00') : undefined),
      timeSlot: bookingType === 'service' ? timeSlot : undefined,
      guests: guestDetails,
      totalAmount,
      taxAmount: 0,
      serviceFee,
      cleaningFee,
      securityDeposit,
      currency,
      cancellationPolicy,
      specialRequests: specialRequests || undefined,
      paymentStatus: 'pending',
      refundAmount: 0,
      refunded: false,
      couponApplied,
      discountAmount,
      hostFee: hostEarning,
      platformFee: platformFee
    });

    // Create notification for host
    await Notification.create({
      user: host._id,
      type: 'booking',
      title: 'New Booking Request',
      message: `You have a new booking request from ${req.user.name}`,
      relatedEntity: {
        type: 'Booking',
        id: booking._id
      },
      metadata: { bookingId: booking._id }
    });

    // Send email notification to host
    try {
      const bookingDetails = {
        propertyName: listing ? listing.title : service.title,
        guestName: req.user.name,
        checkIn: actualListingId ? new Date(checkIn).toLocaleDateString() : new Date(timeSlot.startTime).toLocaleDateString(),
        checkOut: actualListingId ? new Date(checkOut).toLocaleDateString() : new Date(timeSlot.endTime).toLocaleDateString(),
        guests: `${guestDetails.adults} adults${guestDetails.children > 0 ? `, ${guestDetails.children} children` : ''}${guestDetails.infants > 0 ? `, ${guestDetails.infants} infants` : ''}`,
        totalAmount: totalAmount.toLocaleString(),
        bookingId: booking._id.toString(),
        specialRequests: specialRequests || null
      };

      await sendNewBookingNotificationEmail(host.email, host.name, bookingDetails);
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
      // Don't fail the booking if email fails
    }

    // Send confirmation email to guest
    try {
      const guestBookingDetails = {
        propertyName: listing ? listing.title : service.title,
        checkIn: actualListingId ? new Date(checkIn).toLocaleDateString() : new Date(timeSlot.startTime).toLocaleDateString(),
        checkOut: actualListingId ? new Date(checkOut).toLocaleDateString() : new Date(timeSlot.endTime).toLocaleDateString(),
        guests: `${guestDetails.adults} adults${guestDetails.children > 0 ? `, ${guestDetails.children} children` : ''}${guestDetails.infants > 0 ? `, ${guestDetails.infants} infants` : ''}`,
        totalAmount: totalAmount.toLocaleString(),
        bookingId: booking._id.toString()
      };

      await sendBookingConfirmationEmail(req.user.email, req.user.name, guestBookingDetails);
    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
      // Don't fail the booking if email fails
    }



    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: { booking }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating booking',
      error: error.message
    });
  }
};

// @desc    Get user's bookings
// @route   GET /api/bookings/my-bookings
// @access  Private
const getMyBookings = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = { user: req.user._id };
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('listing', 'title images location propertyType')
      .populate('service', 'title media')
      .populate('host', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Booking.countDocuments(query);

    // Map listing to propertyId for frontend compatibility
    const bookingsWithPropertyId = bookings.map(booking => {
      const obj = booking.toObject();
      obj.propertyId = obj.listing || null;
      // Ensure images is an array of URLs for frontend compatibility
      if (obj.propertyId && Array.isArray(obj.propertyId.images)) {
        obj.propertyId.images = obj.propertyId.images.map(img => img.url || img);
      }
      return obj;
    });

    res.status(200).json({
      success: true,
      data: {
        bookings: bookingsWithPropertyId,
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
      message: 'Error fetching bookings',
      error: error.message
    });
  }
};

// @desc    Get host's bookings
// @route   GET /api/bookings/host-bookings
// @access  Private
const getHostBookings = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const query = { host: req.user._id };
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('listing', 'title images location pricing')
      .populate('service', 'title media pricing')
      .populate('user', 'name profileImage')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();



    const total = await Booking.countDocuments(query);

    // Map listing images to URLs for frontend compatibility
    const bookingsWithImageUrls = bookings.map(booking => {
      const obj = booking.toObject();
      if (obj.listing && Array.isArray(obj.listing.images)) {
        obj.listing.images = obj.listing.images.map(img => img.url || img);
      }
      if (obj.service && Array.isArray(obj.service.media)) {
        obj.service.media = obj.service.media.map(media => media.url || media);
      }
      return obj;
    });

    res.status(200).json({
      success: true,
      data: {
        bookings: bookingsWithImageUrls,
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
      message: 'Error fetching host bookings',
      error: error.message
    });
  }
};

// @desc    Get single booking
// @route   GET /api/bookings/:id
// @access  Private
const getBooking = async (req, res) => {
  try {
    const { id } = req.params;
    
    const booking = await Booking.findById(id)
      .populate('listing', 'title images description location propertyType amenities cancellationPolicy checkInTime checkOutTime bedrooms bathrooms maxGuests')
      .populate('service', 'title media description pricing cancellationPolicy')
      .populate('user', 'name email profileImage')
      .populate('host', 'name email profileImage about responseTime')
      .populate('couponApplied', 'code discountType amount')
      .populate('payment', 'amount status paymentMethod paidAt transactionId')
      .exec();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check authorization - user can view if they are the guest, host, or admin
    const isGuest = booking.user && booking.user._id.toString() === req.user._id.toString();
    const isHost = booking.host && booking.host._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isGuest && !isHost && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this booking'
      });
    }



    // Calculate fee breakdown for display
    const feeBreakdown = {
      baseAmount: booking.totalAmount + booking.discountAmount,
      serviceFee: booking.serviceFee,
      cleaningFee: booking.cleaningFee,
      securityDeposit: booking.securityDeposit,
      platformFee: booking.platformFee,
      hostEarning: booking.hostFee,
      discountAmount: booking.discountAmount,
      totalAmount: booking.totalAmount
    };

    res.status(200).json({
      success: true,
      data: { 
        booking,
        feeBreakdown
      }
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking',
      error: error.message
    });
  }
};

// @desc    Download booking receipt
// @route   GET /api/bookings/:id/receipt
// @access  Private
const downloadReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    
    const booking = await Booking.findById(id)
      .populate('listing', 'title images description location pricing cancellationPolicy checkInTime checkOutTime')
      .populate('service', 'title media description pricing cancellationPolicy')
      .populate('user', 'name email profileImage')
      .populate('host', 'name email profileImage')
      .populate('couponApplied', 'code discountType amount')
      .populate('payment', 'amount status paymentMethod')
      .exec();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check authorization - user can download if they are the guest, host, or admin
    const isGuest = booking.user && booking.user._id.toString() === req.user._id.toString();
    const isHost = booking.host && booking.host._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isGuest && !isHost && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to download this receipt'
      });
    }

    // Generate receipt
    const receipt = generateReceipt(booking, booking.payment);
    const receiptHTML = generateReceiptHTML(receipt);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${booking.receiptId}.html"`);
    
    res.send(receiptHTML);
  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating receipt',
      error: error.message
    });
  }
};

// @desc    Update booking status (confirm/cancel)
// @route   PUT /api/bookings/:id/status
// @access  Private
const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check authorization
    const isHost = booking.host.toString() === req.user._id.toString();
    const isGuest = booking.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isHost && !isGuest && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this booking'
      });
    }

    // Validate status transition
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
      expired: []
    };

    if (!validTransitions[booking.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${booking.status} to ${status}`
      });
    }

    // Prevent cancellation if booking has started or guest is checked in
    if (status === 'cancelled') {
      // Check if guest is already checked in
      if (booking.checkedIn) {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel booking after guest has checked in'
        });
      }

      // Check if booking has started
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let bookingStartDate;
      if (booking.bookingType === 'property') {
        bookingStartDate = new Date(booking.checkIn);
      } else {
        bookingStartDate = new Date(booking.timeSlot.startTime);
      }
      bookingStartDate.setHours(0, 0, 0, 0);

      if (today >= bookingStartDate) {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel booking after the start date'
        });
      }

      const cancellationPolicy = booking.cancellationPolicy;
      let refundAmount = 0;

      if (cancellationPolicy === 'flexible') {
        // Full refund if cancelled more than 24 hours before check-in
        const checkInTime = booking.checkIn || booking.timeSlot?.startTime;
        const hoursUntilCheckIn = (checkInTime - new Date()) / (1000 * 60 * 60);
        
        if (hoursUntilCheckIn > 24) {
          refundAmount = booking.totalAmount;
        }
      } else if (cancellationPolicy === 'moderate') {
        // Full refund if cancelled more than 5 days before check-in
        const checkInTime = booking.checkIn || booking.timeSlot?.startTime;
        const daysUntilCheckIn = (checkInTime - new Date()) / (1000 * 60 * 60 * 24);
        
        if (daysUntilCheckIn > 5) {
          refundAmount = booking.totalAmount;
        } else if (daysUntilCheckIn > 1) {
          refundAmount = booking.totalAmount * 0.5; // 50% refund
        }
      } else if (cancellationPolicy === 'strict') {
        // 50% refund if cancelled more than 7 days before check-in
        const checkInTime = booking.checkIn || booking.timeSlot?.startTime;
        const daysUntilCheckIn = (checkInTime - new Date()) / (1000 * 60 * 60 * 24);
        
        if (daysUntilCheckIn > 7) {
          refundAmount = booking.totalAmount * 0.5;
        }
      }

      booking.refundAmount = refundAmount;
      booking.paymentStatus = refundAmount > 0 ? 'partially_refunded' : 'paid';
    }

    booking.status = status;

    // Update payment status for confirmed bookings
    if (status === 'confirmed') {
      booking.paymentStatus = 'paid';
    }

    await booking.save();

    // Create notification
    const notificationUser = isHost ? booking.user : booking.host;
    const notificationMessage = isHost 
      ? `Your booking has been ${status} by the host`
      : `A guest has ${status} their booking`;

    await Notification.create({
      user: notificationUser,
      type: 'booking',
      title: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: notificationMessage,
      relatedEntity: {
        type: 'Booking',
        id: booking._id
      },
      metadata: { bookingId: booking._id, status }
    });

    // Send email notifications
    try {
      const [guest, hostUser] = await Promise.all([
        User.findById(booking.user),
        User.findById(booking.host)
      ]);

      const bookingDetails = {
        propertyName: booking.listing ? booking.listing.title : booking.service.title,
        bookingId: booking._id.toString(),
        status: status,
        reason: reason || null
      };

      if (status === 'confirmed') {
        // Send confirmation email to guest
        if (isHost) {
          // Host confirmed the booking - use host action template
          await sendHostConfirmedBookingEmail(guest.email, guest.name, {
            ...bookingDetails,
            checkIn: booking.checkIn ? new Date(booking.checkIn).toLocaleDateString() : new Date(booking.timeSlot.startTime).toLocaleDateString(),
            checkOut: booking.checkOut ? new Date(booking.checkOut).toLocaleDateString() : new Date(booking.timeSlot.endTime).toLocaleDateString(),
            totalAmount: booking.totalAmount.toLocaleString()
          });
        } else {
          // Guest confirmed the booking - use regular template
          await sendBookingConfirmationEmail(guest.email, guest.name, {
            ...bookingDetails,
            checkIn: booking.checkIn ? new Date(booking.checkIn).toLocaleDateString() : new Date(booking.timeSlot.startTime).toLocaleDateString(),
            checkOut: booking.checkOut ? new Date(booking.checkOut).toLocaleDateString() : new Date(booking.timeSlot.endTime).toLocaleDateString(),
            guests: `${booking.guests.adults} adults${booking.guests.children > 0 ? `, ${booking.guests.children} children` : ''}${booking.guests.infants > 0 ? `, ${booking.guests.infants} infants` : ''}`,
            totalAmount: booking.totalAmount.toLocaleString()
          });
        }
      } else if (status === 'cancelled') {
        // Send cancellation email to guest
        if (isHost) {
          // Host cancelled the booking - use host action template
          await sendHostCancelledBookingEmail(guest.email, guest.name, {
            ...bookingDetails,
            checkIn: booking.checkIn ? new Date(booking.checkIn).toLocaleDateString() : new Date(booking.timeSlot.startTime).toLocaleDateString(),
            checkOut: booking.checkOut ? new Date(booking.checkOut).toLocaleDateString() : new Date(booking.timeSlot.endTime).toLocaleDateString(),
            refundAmount: booking.refundAmount ? booking.refundAmount.toLocaleString() : '0',
            reason: reason || 'Host decision'
          });
        } else {
          // Guest cancelled the booking - use regular template
          await sendBookingCancellationEmail(guest.email, guest.name, {
            ...bookingDetails,
            checkIn: booking.checkIn ? new Date(booking.checkIn).toLocaleDateString() : new Date(booking.timeSlot.startTime).toLocaleDateString(),
            checkOut: booking.checkOut ? new Date(booking.checkOut).toLocaleDateString() : new Date(booking.timeSlot.endTime).toLocaleDateString(),
            refundAmount: booking.refundAmount ? booking.refundAmount.toLocaleString() : '0'
          });
        }
      } else if (status === 'completed' && isHost) {
        // Host marked booking as completed - use host action template
        await sendHostCompletedBookingEmail(guest.email, guest.name, {
          ...bookingDetails,
          checkIn: booking.checkIn ? new Date(booking.checkIn).toLocaleDateString() : new Date(booking.timeSlot.startTime).toLocaleDateString(),
          checkOut: booking.checkOut ? new Date(booking.checkOut).toLocaleDateString() : new Date(booking.timeSlot.endTime).toLocaleDateString()
        });
      } else if (isHost && status !== 'confirmed' && status !== 'cancelled') {
        // Other host status updates - use host action template
        await sendHostStatusUpdateEmail(guest.email, guest.name, {
          ...bookingDetails,
          previousStatus: booking.status,
          newStatus: status,
          reason: reason || null
        });
      }
    } catch (emailError) {
      console.error('Error sending status update emails:', emailError);
      // Don't fail the status update if email fails
    }

    res.status(200).json({
      success: true,
      message: `Booking ${status} successfully`,
      data: { booking }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating booking status',
      error: error.message
    });
  }
};

// @desc    Check-in guest for booking
// @route   POST /api/bookings/:id/check-in
// @access  Private
const checkInGuest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    const booking = await Booking.findById(id)
      .populate('user', 'name email phone')
      .populate('host', 'name email phone')
      .populate('listing', 'title location')
      .populate('service', 'title location')
      .exec();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user is the host of this booking
    if (booking.host._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can check-in guests'
      });
    }

    // Check if booking is confirmed
    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed bookings can be checked in'
      });
    }

    // Check if already checked in
    if (booking.checkedIn) {
      return res.status(400).json({
        success: false,
        message: 'Guest has already been checked in'
      });
    }

    // Check if it's the check-in date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let checkInDate;
    if (booking.bookingType === 'property') {
      checkInDate = new Date(booking.checkIn);
    } else {
      checkInDate = new Date(booking.timeSlot.startTime);
    }
    checkInDate.setHours(0, 0, 0, 0);

    if (today < checkInDate) {
      return res.status(400).json({
        success: false,
        message: 'Cannot check-in before the booking start date'
      });
    }

    // Perform check-in
    booking.checkedIn = true;
    booking.checkedInAt = new Date();
            booking.checkedInBy = req.user._id;
    booking.checkInNotes = notes || undefined;
    
    await booking.save();

    // Create notification for guest
    await Notification.create({
      user: booking.user._id,
      type: 'check_in',
      title: 'Check-in Completed',
      message: `You have been successfully checked in for your booking`,
      relatedEntity: {
        type: 'Booking',
        id: booking._id
      },
      metadata: { bookingId: booking._id }
    });

    // Send email notification to guest
    try {
      const checkInDetails = {
        propertyName: booking.listing?.title || booking.service?.title,
        bookingId: booking._id,
        checkInDate: new Date().toLocaleDateString(),
        checkInTime: new Date().toLocaleTimeString(),
        notes: notes || 'No additional notes'
      };

      await sendHostCheckInGuestEmail(booking.user.email, booking.user.name, checkInDetails);
  
    } catch (emailError) {
      console.error('Error sending check-in email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Guest checked in successfully',
      data: { booking }
    });
  } catch (error) {
    console.error('Error checking in guest:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking in guest',
      error: error.message
    });
  }
};

// @desc    Calculate booking price
// @route   POST /api/bookings/calculate-price
// @access  Public
const calculateBookingPrice = async (req, res) => {
  try {
    const {
      listingId,
      serviceId,
      checkIn,
      checkOut,
      guests,
      couponCode
    } = req.body;

    let listing = null;
    let service = null;

    if (listingId) {
      listing = await Property.findById(listingId);
      if (!listing) {
        return res.status(404).json({
          success: false,
          message: 'Listing not found'
        });
      }
    } else if (serviceId) {
      service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }
    }

    // Calculate base price
    let totalAmount = 0;
    let basePrice = 0;
    let extraGuestPrice = 0;
    let cleaningFee = 0;
    let serviceFee = 0;
    let nights = 0;

    if (listing) {
      basePrice = listing.pricing.basePrice;
      extraGuestPrice = listing.pricing.extraGuestPrice;
      cleaningFee = listing.pricing.cleaningFee;
      serviceFee = listing.pricing.serviceFee;

      if (checkIn && checkOut) {
        nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
        totalAmount = basePrice * nights;

        // Add extra guest charges
        if (guests && guests.adults > 1) {
          const extraGuests = guests.adults - 1;
          totalAmount += extraGuestPrice * extraGuests * nights;
        }
      }

      totalAmount += cleaningFee + serviceFee;
    } else if (service) {
      basePrice = service.pricing.basePrice;
      totalAmount = basePrice;

      // Add per-person charges
      if (guests && guests.adults > 1) {
        totalAmount += service.pricing.perPersonPrice * (guests.adults - 1);
      }
    }

    // Apply coupon
    let discountAmount = 0;
    let couponDetails = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validTo: { $gte: new Date() }
      });

      if (coupon) {
        if (coupon.discountType === 'percentage') {
          discountAmount = (totalAmount * coupon.amount) / 100;
          if (coupon.maxDiscount) {
            discountAmount = Math.min(discountAmount, coupon.maxDiscount);
          }
        } else {
          discountAmount = coupon.amount;
        }

        if (coupon.minBookingAmount && totalAmount < coupon.minBookingAmount) {
          discountAmount = 0;
        }

        totalAmount -= discountAmount;
        couponDetails = {
          code: coupon.code,
          discountType: coupon.discountType,
          amount: coupon.amount
        };
      }
    }

    const breakdown = {
      basePrice: listing ? basePrice * nights : basePrice,
      extraGuestPrice: listing && guests ? extraGuestPrice * (guests.adults - 1) * nights : 0,
      cleaningFee,
      serviceFee,
      discountAmount,
      totalAmount
    };

    res.status(200).json({
      success: true,
      data: {
        breakdown,
        couponDetails,
        currency: listing ? listing.pricing.currency : service.pricing.currency
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error calculating price',
      error: error.message
    });
  }
};

// @desc    Cancel booking
// @route   DELETE /api/bookings/:id
// @access  Private
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    // Use _id instead of id for Mongoose documents
    const userId = req.user._id;

    // Find the booking
    const booking = await Booking.findById(id)
      .populate('listing', 'title host cancellationPolicy pricing')
      .populate('host', 'name email')
      .populate('user', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user is authorized to cancel this booking
    // User can cancel if they are the booking owner OR the host
    const isBookingOwner = booking.user && (
      (typeof booking.user === 'string' && booking.user === userId.toString()) ||
      (booking.user._id && booking.user._id.toString() === userId.toString())
    );
    
    const isHost = booking.host && (
      (typeof booking.host === 'string' && booking.host === userId.toString()) ||
      (booking.host._id && booking.host._id.toString() === userId.toString())
    );
    
    // Add debug logging
    console.log('🔍 Authorization check for booking cancellation:');
    console.log('🔍 Current user ID:', userId.toString());
    console.log('🔍 Booking user ID:', booking.user ? (typeof booking.user === 'string' ? booking.user : booking.user._id?.toString()) : 'null');
    console.log('🔍 Booking host ID:', booking.host ? (typeof booking.host === 'string' ? booking.host : booking.host._id?.toString()) : 'null');
    console.log('🔍 Is booking owner:', isBookingOwner);
    console.log('🔍 Is host:', isHost);
    
    if (!isBookingOwner && !isHost) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to cancel this booking. Only the booking owner or host can cancel.',
        debug: {
          userId: userId.toString(),
          bookingUserId: booking.user ? (typeof booking.user === 'string' ? booking.user : booking.user._id?.toString()) : 'null',
          bookingHostId: booking.host ? (typeof booking.host === 'string' ? booking.host : booking.host._id?.toString()) : 'null'
        }
      });
    }

    // Check if booking can be cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed booking'
      });
    }

    // Calculate refund based on cancellation policy
    const cancellationPolicy = booking.listing?.cancellationPolicy || 'moderate';
    const checkInDate = new Date(booking.checkIn);
    const now = new Date();
    const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const daysUntilCheckIn = Math.ceil(hoursUntilCheckIn / 24);
    
    let refundAmount = 0;
    let refundPercentage = 0;
    let policyDescription = '';
    let canCancel = true;

    // Determine refund based on policy and time until check-in
    switch (cancellationPolicy) {
      case 'flexible':
        if (hoursUntilCheckIn > 24) {
          refundPercentage = 100;
          policyDescription = 'Full refund if cancelled more than 24 hours before check-in';
        } else {
          refundPercentage = 0;
          policyDescription = 'No refund if cancelled within 24 hours of check-in';
        }
        break;
      case 'moderate':
        if (hoursUntilCheckIn > 120) { // 5 days
          refundPercentage = 100;
          policyDescription = 'Full refund if cancelled more than 5 days before check-in';
        } else if (hoursUntilCheckIn > 24) {
          refundPercentage = 50;
          policyDescription = '50% refund if cancelled between 1-5 days before check-in';
        } else {
          refundPercentage = 0;
          policyDescription = 'No refund if cancelled within 24 hours of check-in';
        }
        break;
      case 'strict':
        if (hoursUntilCheckIn > 168) { // 7 days
          refundPercentage = 50;
          policyDescription = '50% refund if cancelled more than 7 days before check-in';
        } else {
          refundPercentage = 0;
          policyDescription = 'No refund if cancelled within 7 days of check-in';
        }
        break;
      case 'super_strict':
        refundPercentage = 0;
        policyDescription = 'No refunds under any circumstances';
        break;
      default:
        refundPercentage = 0;
        policyDescription = 'Standard cancellation policy applies';
    }

    // Check if cancellation is allowed based on policy
    if (cancellationPolicy === 'super_strict' && hoursUntilCheckIn <= 168) {
      canCancel = false;
    }

    if (!canCancel) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation not allowed according to the host\'s strict policy',
        data: {
          cancellationPolicy,
          policyDescription,
          daysUntilCheckIn,
          hoursUntilCheckIn: Math.ceil(hoursUntilCheckIn)
        }
      });
    }

    refundAmount = (booking.totalAmount * refundPercentage) / 100;

    // Update booking status
    booking.status = 'cancelled';
    booking.cancellationReason = reason || 'Cancelled by user';
    booking.cancelledAt = new Date();
    booking.cancelledBy = userId;
    booking.refundAmount = refundAmount;
    booking.refundStatus = refundAmount > 0 ? 'pending' : 'not_applicable';

    await booking.save();

    // Release dates back to availability system
    if (booking.listing && booking.checkIn && booking.checkOut) {
      try {
        console.log('🔄 Releasing property dates back to availability system...');
        
        // Generate array of dates to release
        const startDate = new Date(booking.checkIn);
        const endDate = new Date(booking.checkOut);
        const datesToRelease = [];
        
        let currentDate = new Date(startDate);
        while (currentDate < endDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          datesToRelease.push(dateStr);
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        console.log('📅 Property dates to release:', datesToRelease);
        
                        // Update availability records to mark dates as available again
                const updateResult = await Availability.updateMany(
                  {
                    property: booking.listing,
                    date: { $in: datesToRelease },
                    status: 'booked'
                  },
                  {
                    $set: {
                      status: 'available',
                      bookedBy: null,
                      bookedAt: null,
                      reason: null
                    },
                    $unset: {
                      bookingId: 1
                    }
                  }
                );
        
                        console.log(`✅ Successfully released ${updateResult.modifiedCount} property dates back to available status (reason field cleared)`);
        
                        // Also handle any blocked dates that might still exist
                await Availability.updateMany(
                  {
                    property: booking.listing,
                    date: { $in: datesToRelease },
                    status: 'blocked'
                  },
                  {
                    $set: {
                      status: 'available',
                      blockedBy: null,
                      blockedAt: null,
                      reason: null
                    }
                  }
                );
        
      } catch (availabilityError) {
        console.error('⚠️ Error releasing property dates to availability system:', availabilityError);
        // Don't fail the cancellation if availability update fails
        // The dates will be cleaned up by the availability controller's cleanup process
      }
    }
    
    // Handle service booking time slot release
    if (booking.service && booking.timeSlot) {
      try {
        console.log('🔄 Releasing service time slot back to availability system...');
        
                        // For services, we need to release the specific time slot
                const timeSlotUpdate = await Availability.updateMany(
                  {
                    service: booking.service,
                    date: new Date(booking.timeSlot.startTime).toISOString().split('T')[0],
                    status: 'booked'
                  },
                  {
                    $set: {
                      status: 'available',
                      bookedBy: null,
                      bookedAt: null,
                      reason: null
                    },
                    $unset: {
                      bookingId: 1
                    }
                  }
                );
        
                        console.log(`✅ Successfully released service time slot back to available status (reason field cleared)`);
        
      } catch (availabilityError) {
        console.error('⚠️ Error releasing service time slot to availability system:', availabilityError);
        // Don't fail the cancellation if availability update fails
      }
    }

    // Create notification for the other party
    const notificationData = {
      user: (booking.user && booking.user.toString() === userId) ? booking.host : booking.user,
      type: 'booking',
      title: 'Booking Cancelled',
      message: `Booking for ${booking.listing?.title || 'property'} has been cancelled`,
      metadata: {
        bookingId: booking._id,
        refundAmount,
        refundPercentage
      }
    };

    if (notificationData.user) {
      await Notification.create(notificationData);
    }

    // If there's a refund, process it
    if (refundAmount > 0) {
      // Find the payment for this booking
      const payment = await Payment.findOne({ booking: booking._id });
      
      if (payment) {
        payment.status = 'refunded';
        payment.refundAmount = refundAmount;
        payment.refundedAt = new Date();
        await payment.save();
      }

      // Send refund notification email
      try {
        if (booking.user && booking.user.email) {
          await sendBookingCancellationEmail(
            booking.user.email,
            booking.user.name || 'User',
            {
              propertyName: booking.listing?.title || 'Property',
              bookingId: booking._id,
              refundAmount,
              refundPercentage,
              checkIn: booking.checkIn,
              checkOut: booking.checkOut
            }
          );
        }
      } catch (emailError) {
        console.error('Error sending cancellation email:', emailError);
      }
    }

    // Prepare detailed refund information
    const refundInfo = {
      originalAmount: booking.totalAmount,
      refundAmount: refundAmount,
      refundPercentage: refundPercentage,
      cancellationPolicy: cancellationPolicy,
      policyDescription: policyDescription,
      timeUntilCheckIn: {
        days: daysUntilCheckIn,
        hours: Math.ceil(hoursUntilCheckIn)
      },
      refundStatus: refundAmount > 0 ? 'pending' : 'not_applicable',
      message: refundAmount > 0 
        ? `You will receive a refund of ₹${refundAmount.toFixed(2)} (${refundPercentage}% of total amount)`
        : 'No refund is applicable based on the cancellation policy'
    };

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        booking: {
          _id: booking._id,
          status: booking.status,
          cancelledAt: booking.cancelledAt,
          cancellationReason: booking.cancellationReason
        },
        refundInfo,
        datesReleased: true,
        message: `Your booking has been cancelled. ${refundInfo.message}`
      }
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling booking',
      error: error.message
    });
  }
};

// @desc    Get booking statistics
// @route   GET /api/bookings/stats
// @access  Private
const getBookingStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const isHost = req.user.role === 'host';

    const query = isHost ? { host: userId } : { user: userId };

    const stats = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const totalBookings = await Booking.countDocuments(query);
    const totalEarnings = await Booking.aggregate([
      { $match: { ...query, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const monthlyStats = await Booking.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          amount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalBookings,
        totalEarnings: totalEarnings[0]?.total || 0,
        statusBreakdown: stats,
        monthlyStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching booking statistics',
      error: error.message
    });
  }
};

// ========================================
// ADMIN FUNCTIONS
// ========================================

// @desc    Get admin booking statistics (platform-wide)
// @route   GET /api/bookings/admin/stats
// @access  Private (Admin only)
const getAdminBookingStats = async (req, res) => {
  try {
    const stats = await Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const totalBookings = await Booking.countDocuments();
    const totalRevenue = await Booking.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const monthlyStats = await Booking.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          amount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
        statusBreakdown: stats,
        monthlyStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching admin booking statistics',
      error: error.message
    });
  }
};

// @desc    Get all bookings (admin only)
// @route   GET /api/bookings/admin/all
// @access  Private (Admin only)
const getAllBookings = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { receiptId: { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } },
        { 'host.name': { $regex: search, $options: 'i' } }
      ];
    }

    const bookings = await Booking.find(query)
      .populate('user', 'name email')
      .populate('host', 'name email')
      .populate('listing', 'title')
      .populate('service', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalBookings: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching all bookings',
      error: error.message
    });
  }
};

// @desc    Admin update booking status
// @route   PUT /api/bookings/admin/:id/status
// @access  Private (Admin only)
const adminUpdateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const booking = await Booking.findById(id)
      .populate('user', 'name email')
      .populate('host', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const oldStatus = booking.status;
    booking.status = status;
    booking.adminNotes = reason || `Status changed from ${oldStatus} to ${status} by admin`;
    booking.updatedAt = new Date();

    await booking.save();

    // Send notification to both user and host
    const notificationData = {
      user: booking.user._id,
      type: 'admin_action',
      title: 'Booking Status Updated',
      message: `Your booking status has been updated to ${status} by an administrator`,
      metadata: { bookingId: booking._id, oldStatus, newStatus: status }
    };

    await Notification.create(notificationData);

    res.status(200).json({
      success: true,
      message: 'Booking status updated successfully',
      data: { booking }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating booking status',
      error: error.message
    });
  }
};

// @desc    Check cancellation eligibility and refund amount
// @route   GET /api/bookings/:id/cancellation-info
// @access  Private
const getCancellationInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Find the booking
    const booking = await Booking.findById(id)
      .populate('listing', 'title host cancellationPolicy pricing')
      .populate('host', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user is authorized to view this booking
    if (booking.user.toString() !== userId.toString() && booking.host.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this booking'
      });
    }

    // Check if booking can be cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed booking'
      });
    }

    // Calculate potential refund
    const cancellationPolicy = booking.listing?.cancellationPolicy || 'moderate';
    const checkInDate = new Date(booking.checkIn);
    const now = new Date();
    const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    const daysUntilCheckIn = Math.ceil(hoursUntilCheckIn / 24);
    
    let refundAmount = 0;
    let refundPercentage = 0;
    let policyDescription = '';
    let canCancel = true;

    // Determine refund based on policy and time until check-in
    switch (cancellationPolicy) {
      case 'flexible':
        if (hoursUntilCheckIn > 24) {
          refundPercentage = 100;
          policyDescription = 'Full refund if cancelled more than 24 hours before check-in';
        } else {
          refundPercentage = 0;
          policyDescription = 'No refund if cancelled within 24 hours of check-in';
        }
        break;
      case 'moderate':
        if (hoursUntilCheckIn > 120) { // 5 days
          refundPercentage = 100;
          policyDescription = 'Full refund if cancelled more than 5 days before check-in';
        } else if (hoursUntilCheckIn > 24) {
          refundPercentage = 50;
          policyDescription = '50% refund if cancelled between 1-5 days before check-in';
        } else {
          refundPercentage = 0;
          policyDescription = 'No refund if cancelled within 24 hours of check-in';
        }
        break;
      case 'strict':
        if (hoursUntilCheckIn > 168) { // 7 days
          refundPercentage = 50;
          policyDescription = '50% refund if cancelled more than 7 days before check-in';
        } else {
          refundPercentage = 0;
          policyDescription = 'No refund if cancelled within 7 days of check-in';
        }
        break;
      case 'super_strict':
        refundPercentage = 0;
        policyDescription = 'No refunds under any circumstances';
        break;
      default:
        refundPercentage = 0;
        policyDescription = 'Standard cancellation policy applies';
    }

    // Check if cancellation is allowed based on policy
    if (cancellationPolicy === 'super_strict' && hoursUntilCheckIn <= 168) {
      canCancel = false;
    }

    refundAmount = (booking.totalAmount * refundPercentage) / 100;

    const cancellationInfo = {
      canCancel,
      cancellationPolicy,
      policyDescription,
      timeUntilCheckIn: {
        days: daysUntilCheckIn,
        hours: Math.ceil(hoursUntilCheckIn)
      },
      refundDetails: {
        originalAmount: booking.totalAmount,
        refundAmount: refundAmount,
        refundPercentage: refundPercentage,
        refundStatus: refundAmount > 0 ? 'eligible' : 'not_applicable'
      },
      message: canCancel 
        ? (refundAmount > 0 
            ? `You can cancel this booking and receive a refund of ₹${refundAmount.toFixed(2)} (${refundPercentage}% of total amount)`
            : 'You can cancel this booking, but no refund is applicable based on the cancellation policy')
        : 'Cancellation is not allowed according to the host\'s strict policy'
    };

    res.status(200).json({
      success: true,
      data: cancellationInfo
    });

  } catch (error) {
    console.error('Error getting cancellation info:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting cancellation information',
      error: error.message
    });
  }
};

// @desc    Admin delete booking
// @route   DELETE /api/bookings/admin/:id
// @access  Private (Admin only)
const adminDeleteBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Soft delete - mark as deleted instead of actually removing
    booking.isDeleted = true;
    booking.deletedAt = new Date();
    booking.deletedBy = req.user._id;
    booking.deletionReason = reason || 'Deleted by administrator';
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting booking',
      error: error.message
    });
  }
};

// @desc    Cleanup expired blocked bookings (utility function)
// @access  Private (Internal use)
const cleanupExpiredBlockedBookings = async () => {
  try {
    console.log('🔄 Cleaning up expired blocked bookings...');
    
    // Find bookings that are blocked and expired (older than 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    const expiredBlockedBookings = await Booking.find({
      status: 'blocked',
      createdAt: { $lt: thirtyMinutesAgo }
    });

    if (expiredBlockedBookings.length === 0) {
      console.log('✅ No expired blocked bookings found');
      return { cleaned: 0 };
    }

    console.log(`🔄 Found ${expiredBlockedBookings.length} expired blocked bookings to clean up`);

    // Update these bookings to cancelled status
    const updateResult = await Booking.updateMany(
      {
        _id: { $in: expiredBlockedBookings.map(b => b._id) }
      },
      {
        $set: {
          status: 'cancelled',
          cancellationReason: 'Expired - payment not completed within time limit',
          cancelledAt: new Date()
        }
      }
    );

    console.log(`✅ Successfully cleaned up ${updateResult.modifiedCount} expired blocked bookings`);
    
    return { cleaned: updateResult.modifiedCount };
  } catch (error) {
    console.error('❌ Error cleaning up expired blocked bookings:', error);
    throw error;
  }
};

// @desc    Release booking dates (admin only)
// @route   POST /api/bookings/admin/:id/release-dates
// @access  Private (Admin only)
const releaseBookingDates = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Release property dates back to availability system
    if (booking.listing && booking.checkIn && booking.checkOut) {
      try {
        console.log('🔄 Admin releasing property dates back to availability system...');
        
        // Generate array of dates to release
        const startDate = new Date(booking.checkIn);
        const endDate = new Date(booking.checkOut);
        const datesToRelease = [];
        
        let currentDate = new Date(startDate);
        while (currentDate < endDate) {
          const dateStr = currentDate.toISOString().split('T')[0];
          datesToRelease.push(dateStr);
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        console.log('📅 Property dates to release:', datesToRelease);
        
        // Update availability records to mark dates as available again
        const updateResult = await Availability.updateMany(
          {
            property: booking.listing,
            date: { $in: datesToRelease },
            status: 'booked'
          },
          {
            $set: {
              status: 'available',
              bookedBy: null,
              bookedAt: null,
              reason: null
            },
            $unset: {
              bookingId: 1
            }
          }
        );
        
        console.log(`✅ Successfully released ${updateResult.modifiedCount} property dates back to available status`);
        
        // Also handle any blocked dates that might still exist
        await Availability.updateMany(
          {
            property: booking.listing,
            date: { $in: datesToRelease },
            status: 'blocked'
          },
          {
            $set: {
              status: 'available',
              blockedBy: null,
              blockedAt: null,
              reason: null
            }
          }
        );
        
      } catch (availabilityError) {
        console.error('⚠️ Error releasing property dates to availability system:', availabilityError);
        return res.status(500).json({
          success: false,
          message: 'Error releasing property dates',
          error: availabilityError.message
        });
      }
    }
    
    // Handle service booking time slot release
    if (booking.service && booking.timeSlot) {
      try {
        console.log('🔄 Admin releasing service time slot back to availability system...');
        
        // For services, we need to release the specific time slot
        const timeSlotUpdate = await Availability.updateMany(
          {
            service: booking.service,
            date: new Date(booking.timeSlot.startTime).toISOString().split('T')[0],
            status: 'booked'
          },
          {
            $set: {
              status: 'available',
              bookedBy: null,
              bookedAt: null,
              reason: null
            },
            $unset: {
              bookingId: 1
            }
          }
        );
        
        console.log(`✅ Successfully released service time slot back to available status`);
        
      } catch (availabilityError) {
        console.error('⚠️ Error releasing service time slot to availability system:', availabilityError);
        return res.status(500).json({
          success: false,
          message: 'Error releasing service time slot',
          error: availabilityError.message
        });
      }
    }

    // Update booking status to reflect the release
    booking.status = 'cancelled';
    booking.cancellationReason = reason || 'Dates released by administrator';
    booking.cancelledAt = new Date();
    booking.cancelledBy = req.user._id;
    booking.adminAction = true;

    await booking.save();

    // Create notification for both user and host
    const notificationData = [
      {
        user: booking.user,
        type: 'admin_action',
        title: 'Booking Dates Released',
        message: `Your booking dates have been released by an administrator`,
        metadata: { bookingId: booking._id, reason: reason || 'Administrative action' }
      },
      {
        user: booking.host,
        type: 'admin_action',
        title: 'Booking Dates Released',
        message: `A guest's booking dates have been released by an administrator`,
        metadata: { bookingId: booking._id, reason: reason || 'Administrative action' }
      }
    ];

    await Notification.insertMany(notificationData);

    res.status(200).json({
      success: true,
      message: 'Booking dates released successfully',
      data: {
        booking: {
          _id: booking._id,
          status: booking.status,
          cancelledAt: booking.cancelledAt,
          cancellationReason: booking.cancellationReason
        },
        datesReleased: true,
        message: 'The booking dates have been released and are now available for other guests'
      }
    });
  } catch (error) {
    console.error('Error releasing booking dates:', error);
    res.status(500).json({
      success: false,
      message: 'Error releasing booking dates',
      error: error.message
    });
  }
};

module.exports = {
  // Guest functions
  createBooking,
  getMyBookings,
  getBookingById: getBooking,
  cancelBooking,
  downloadReceipt,
  getCancellationInfo,
  
  // Host functions
  getHostBookings,
  updateBookingStatus,
  checkInGuest,
  getBookingStats,
  
  // Admin functions
  getAdminBookingStats,
  getAllBookings,
  adminUpdateBookingStatus,
  adminDeleteBooking,
  releaseBookingDates,
  
  // Shared functions
  calculateBookingPrice,
  
  // Utility functions
  cleanupExpiredBlockedBookings,
  
  // Legacy aliases for backward compatibility
  getBooking,
  getBookingStats
};

 