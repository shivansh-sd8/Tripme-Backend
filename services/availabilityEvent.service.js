/**
 * ========================================
 * Availability Event Service (NEW)
 * ========================================
 * Handles event-based availability management for flexible hourly bookings
 * with maintenance periods.
 * 
 * FLOW EXAMPLE:
 * - User books: Dec 5, 3PM → Dec 7, 3PM (2 days)
 * - + 6-hour extension → checkout: Dec 7, 9PM
 * - + 2-hour maintenance → Dec 7, 9PM to 11PM
 * - = Available for next booking: Dec 7, 11PM
 * 
 * Created: Dec 2024
 */

const AvailabilityEvent = require('../models/HourlyBasedAvailability');
const Availability = require('../models/Availability');
const Booking = require('../models/Booking');

class AvailabilityEventService {
  
  /**
   * ========================================
   * CREATE BOOKING EVENTS
   * ========================================
   * Creates booking_start and booking_end events when a booking is made.
   * Also auto-creates maintenance events.
   * 
   * @param {Object} params - Booking parameters
   * @param {string} params.propertyId - Property ID
   * @param {string} params.bookingId - Booking ID
   * @param {string} params.userId - User ID
   * @param {Date} params.checkIn - Check-in date/time
   * @param {Date} params.checkOut - Check-out date/time (with extension if any)
   * @param {number} params.maintenanceHours - Maintenance hours (default 2)
   * @returns {Promise<Object>} Created events
   */
  static async createBookingEvents({ propertyId, bookingId, userId, checkIn, checkOut, maintenanceHours = 2 }) {
    try {
      const events = [];
      
      // 1. Create booking_start event
      const bookingStartEvent = new AvailabilityEvent({
        property: propertyId,
        time: new Date(checkIn),
        eventType: 'booking_start',
        bookingId: bookingId,
        userId: userId,
        meta: {
          checkIn: checkIn,
          checkOut: checkOut
        }
      });
      events.push(await bookingStartEvent.save());
      
      // 2. Create booking_end event
      const bookingEndEvent = new AvailabilityEvent({
        property: propertyId,
        time: new Date(checkOut),
        eventType: 'booking_end',
        bookingId: bookingId,
        userId: userId,
        meta: {
          checkIn: checkIn,
          checkOut: checkOut
        }
      });
      events.push(await bookingEndEvent.save());
      
      // 3. Auto-create maintenance events
      const maintenanceEvents = await this.createMaintenanceEvents({
        propertyId,
        bookingId,
        startTime: new Date(checkOut),
        durationHours: maintenanceHours
      });
      events.push(...maintenanceEvents);
      
      console.log(`✅ Created ${events.length} availability events for booking ${bookingId}`);
      //  review the return value and response for next available time
       console.log('nextAvailableTime', new Date(new Date(checkOut).getTime() + maintenanceHours * 60 * 60 * 1000));
      return {
        success: true,
        events: events,
        nextAvailableTime: new Date(new Date(checkOut).getTime() + maintenanceHours * 60 * 60 * 1000)
      };
      
    } catch (error) {
      console.error('❌ Error creating booking events:', error);
      throw error;
    }
  }
  
  /**
   * ========================================
   * CREATE MAINTENANCE EVENTS
   * ========================================
   * Auto-creates maintenance_start and maintenance_end events after checkout.
   * 
   * @param {Object} params - Maintenance parameters
   * @param {string} params.propertyId - Property ID
   * @param {string} params.bookingId - Booking ID
   * @param {Date} params.startTime - Maintenance start time (checkout time)
   * @param {number} params.durationHours - Maintenance duration in hours (default 2)
   * @returns {Promise<Array>} Created maintenance events
   */
  static async createMaintenanceEvents({ propertyId, bookingId, startTime, durationHours = 2 }) {
    try {
      const events = [];
      
      const maintenanceStart = new Date(startTime);
      const maintenanceEnd = new Date(maintenanceStart.getTime() + durationHours * 60 * 60 * 1000);
      
      // 1. Create maintenance_start event
      const maintenanceStartEvent = new AvailabilityEvent({
        property: propertyId,
        time: maintenanceStart,
        eventType: 'maintenance_start',
        bookingId: bookingId,
        meta: {
          durationHours: durationHours,
          reason: 'Auto-created after booking checkout'
        }
      });
      events.push(await maintenanceStartEvent.save());
      
      // 2. Create maintenance_end event
      const maintenanceEndEvent = new AvailabilityEvent({
        property: propertyId,
        time: maintenanceEnd,
        eventType: 'maintenance_end',
        bookingId: bookingId,
        meta: {
          durationHours: durationHours,
          reason: 'Auto-created after booking checkout'
        }
      });
      events.push(await maintenanceEndEvent.save());
      
      console.log(`🔧 Created maintenance events: ${maintenanceStart.toISOString()} - ${maintenanceEnd.toISOString()}`);
      
      return events;
      
    } catch (error) {
      console.error('❌ Error creating maintenance events:', error);
      throw error;
    }
  }
  

  //  Main controller function to check hourly availability 
  //  Check here computation
  /**
   * ========================================
   * CHECK HOURLY AVAILABILITY
   * ========================================
   * Checks if a specific time slot is available (no overlapping events).
   * 
   * @param {string} propertyId - Property ID
   * @param {Date} startTime - Start date/time
   * @param {Date} endTime - End date/time
   * @param {string} excludeBookingId - Optional booking ID to exclude from check
   * @returns {Promise<Object>} Availability result
   */
  static async checkHourlyAvailability(propertyId, startTime, endTime, excludeBookingId = null) {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      // Get all events for this property in the time range
      const query = {
        property: propertyId,
        time: { $gte: start, $lte: end }
      };
      
      const events = await AvailabilityEvent.find(query).sort({ time: 1 });
      
      // Filter out events from the excluded booking
      const relevantEvents = excludeBookingId 
        ? events.filter(e => e.bookingId?.toString() !== excludeBookingId)
        : events;
      
      // Check for blocking events (booking or maintenance in progress)
      const blockingEvents = relevantEvents.filter(e => 
        ['booking_start', 'maintenance_start', 'block_start'].includes(e.eventType)
      );
      
      // Also check for events that overlap the requested time slot
      // A slot is blocked if there's a start event before our end time 
      // without a corresponding end event before our start time
      const conflictingStarts = await AvailabilityEvent.find({
        property: propertyId,
        eventType: { $in: ['booking_start', 'maintenance_start', 'block_start'] },
        time: { $lt: end },
        ...(excludeBookingId && { bookingId: { $ne: excludeBookingId } })
      });
      
      // Check if any of these have ended before our start time
      for (const startEvent of conflictingStarts) {
        const endEventType = startEvent.eventType.replace('_start', '_end');
        const endEvent = await AvailabilityEvent.findOne({
          property: propertyId,
          eventType: endEventType,
          bookingId: startEvent.bookingId,
          time: { $lte: start }
        });
        
        // If no end event before our start, this is a conflict
        if (!endEvent) {
          return {
            available: false,
            reason: `Conflicting ${startEvent.eventType.replace('_start', '')} from ${startEvent.time.toISOString()}`,
            conflictingEvent: startEvent
          };
        }
      }
      
      return {
        available: true,
        events: relevantEvents
      };
      
    } catch (error) {
      console.error('❌ Error checking hourly availability:', error);
      return {
        available: false,
        reason: error.message
      };
    }
  }
  
  /**
   * ========================================
   * GET NEXT AVAILABLE SLOT
   * ========================================
   * Finds the next available time slot for a property.
   * 
   * @param {string} propertyId - Property ID
   * @param {Date} fromTime - Start searching from this time
   * @param {number} durationHours - Required duration in hours
   * @returns {Promise<Object>} Next available slot info
   */
  static async getNextAvailableSlot(propertyId, fromTime, durationHours = 24) {
    try {
      const searchStart = new Date(fromTime);
      const maxSearchDays = 90; // Search up to 90 days ahead
      
      let currentTime = new Date(searchStart);
      
      for (let day = 0; day < maxSearchDays; day++) {
        const slotEnd = new Date(currentTime.getTime() + durationHours * 60 * 60 * 1000);
        
        const availability = await this.checkHourlyAvailability(propertyId, currentTime, slotEnd);
        
        if (availability.available) {
          return {
            found: true,
            startTime: currentTime,
            endTime: slotEnd,
            durationHours: durationHours
          };
        }
        
        // Move to next hour
        currentTime = new Date(currentTime.getTime() + 60 * 60 * 1000);
      }
      
      return {
        found: false,
        reason: 'No available slots found in the next 90 days'
      };
      
    } catch (error) {
      console.error('❌ Error finding next available slot:', error);
      return {
        found: false,
        reason: error.message
      };
    }
  }
  
  /**
   * ========================================
   * GET PROPERTY EVENTS
   * ========================================
   * Gets all events for a property in a date range.
   * 
   * @param {string} propertyId - Property ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Events array
   */
  static async getPropertyEvents(propertyId, startDate, endDate) {
    try {
      const events = await AvailabilityEvent.find({
        property: propertyId,
        time: { $gte: new Date(startDate), $lte: new Date(endDate) }
      })
      .populate('bookingId', 'checkIn checkOut status')
      .populate('userId', 'name email')
      .sort({ time: 1 });
      
      return events;
      
    } catch (error) {
      console.error('❌ Error getting property events:', error);
      return [];
    }
  }
  
  /**
   * ========================================
   * DELETE BOOKING EVENTS
   * ========================================
   * Removes all events associated with a booking (for cancellation).
   * 
   * @param {string} bookingId - Booking ID
   * @returns {Promise<Object>} Deletion result
   */
  static async deleteBookingEvents(bookingId) {
    try {
      const result = await AvailabilityEvent.deleteMany({ bookingId: bookingId });
      
      console.log(`🗑️ Deleted ${result.deletedCount} events for booking ${bookingId}`);
      
      return {
        success: true,
        deletedCount: result.deletedCount
      };
      
    } catch (error) {
      console.error('❌ Error deleting booking events:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * ========================================
   * CREATE BLOCK EVENTS
   * ========================================
   * Creates block events (host manually blocking dates).
   * 
   * @param {Object} params - Block parameters
   * @param {string} params.propertyId - Property ID
   * @param {string} params.userId - Host user ID
   * @param {Date} params.startTime - Block start time
   * @param {Date} params.endTime - Block end time
   * @param {string} params.reason - Block reason
   * @returns {Promise<Array>} Created block events
   */
  static async createBlockEvents({ propertyId, userId, startTime, endTime, reason = 'Blocked by host' }) {
    try {
      const events = [];
      
      // 1. Create block_start event
      const blockStartEvent = new AvailabilityEvent({
        property: propertyId,
        time: new Date(startTime),
        eventType: 'block_start',
        userId: userId,
        meta: { reason: reason }
      });
      events.push(await blockStartEvent.save());
      
      // 2. Create block_end event
      const blockEndEvent = new AvailabilityEvent({
        property: propertyId,
        time: new Date(endTime),
        eventType: 'block_end',
        userId: userId,
        meta: { reason: reason }
      });
      events.push(await blockEndEvent.save());
      
      console.log(`🚫 Created block events: ${startTime} - ${endTime}`);
      
      return events;
      
    } catch (error) {
      console.error('❌ Error creating block events:', error);
      throw error;
    }
  }
  
  /**
   * ========================================
   * GET AVAILABILITY TIMELINE
   * ========================================
   * Returns a timeline showing availability status for each hour.
   * Useful for calendar display.
   * 
   * @param {string} propertyId - Property ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Timeline array with hourly status
   */
  static async getAvailabilityTimeline(propertyId, startDate, endDate) {
    try {
      const events = await this.getPropertyEvents(propertyId, startDate, endDate);
      const timeline = [];
      
      let currentTime = new Date(startDate);
      const end = new Date(endDate);
      
      // Track current status
      let currentStatus = 'available';
      let currentBookingId = null;
      
      // Process events to build timeline
      const eventMap = new Map();
      events.forEach(e => {
        const timeKey = e.time.toISOString();
        if (!eventMap.has(timeKey)) {
          eventMap.set(timeKey, []);
        }
        eventMap.get(timeKey).push(e);
      });
      
      while (currentTime < end) {
        const timeKey = currentTime.toISOString();
        const eventsAtTime = eventMap.get(timeKey) || [];
        
        // Update status based on events
        for (const event of eventsAtTime) {
          switch (event.eventType) {
            case 'booking_start':
              currentStatus = 'booked';
              currentBookingId = event.bookingId;
              break;
            case 'booking_end':
              // Don't set to available yet - might have maintenance
              break;
            case 'maintenance_start':
              currentStatus = 'maintenance';
              break;
            case 'maintenance_end':
              currentStatus = 'available';
              currentBookingId = null;
              break;
            case 'block_start':
              currentStatus = 'blocked';
              break;
            case 'block_end':
              currentStatus = 'available';
              break;
          }
        }
        
        timeline.push({
          time: new Date(currentTime),
          status: currentStatus,
          bookingId: currentBookingId
        });
        
        // Move to next hour
        currentTime = new Date(currentTime.getTime() + 60 * 60 * 1000);
      }
      
      return timeline;
      
    } catch (error) {
      console.error('❌ Error getting availability timeline:', error);
      return [];
    }
  }
}

module.exports = AvailabilityEventService;

