const PricingService = require('./pricing.service');
const PaymentService = require('./payment.service');
const AvailabilityService = require('./availability.service');
const AvailabilityEventService = require('./availabilityEvent.service');
const NotificationService = require('./notification.service');
const EmailService = require('./email.service');
const { normalizeToLocalMidnight } = require('../utils/date.utils');

const Booking = require('../models/Booking');

class BookingService {

  static async processBooking(req) {
    const {
      propertyId,
      checkIn,
      checkOut,
      paymentData,
      guests
    } = req.body;

    // 1️⃣ Validate booking parameters
    this.validateBookingInput(req.body);

    // 2️⃣ Calculate pricing
    const pricing = await PricingService.calculate(req.body);

    // 3️⃣ Create booking (pending)
    const booking = await this.createBooking(req, pricing);

    // 4️⃣ Verify payment
    await PaymentService.verify(paymentData, booking);

    // 5️⃣ Block availability
    await AvailabilityService.blockDates({
      propertyId,
      checkIn,
      checkOut,
      bookingId: booking._id,
      userId: req.user._id
    });

    // 6️⃣ Create availability events (maintenance, buffer)
    await AvailabilityEventService.createForBooking(booking);

    // 7️⃣ Update booking status
    booking.paymentStatus = 'paid';
    booking.status = 'pending';
    await booking.save();

    // 8️⃣ Notifications
    await NotificationService.notifyHost(booking);
    await EmailService.sendBookingEmails(booking);

    return {
      message: 'Booking created successfully',
      data: { booking }
    };
  }

  static validateBookingInput(body) {
    if (!body.checkIn || !body.checkOut) {
      throw new Error('Check-in and check-out are required');
    }
  }

  static async createBooking(req, pricing) {
    return Booking.create({
      user: req.user._id,
      listing: req.body.propertyId,
      checkIn: new Date(req.body.checkIn),
      checkOut: new Date(req.body.checkOut),
      guests: req.body.guests,
      totalAmount: pricing.totalAmount,
      pricingBreakdown: pricing.breakdown,
      status: 'initiated',
      paymentStatus: 'pending'
    });
  }
}

module.exports = BookingService;
