const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  // Check if SMTP is configured
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Email templates
const emailTemplates = {
  welcome: (userName, verificationLink) => ({
    subject: 'Welcome to TripMe! Verify Your Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Welcome to TripMe!</h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">Your adventure begins here</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
          <h2 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 24px;">Hello ${userName}! 👋</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Thank you for joining our community! We're excited to have you on board. To get started and unlock all the amazing features, please verify your email address.
          </p>
          
          <!-- Verification Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 25px; display: inline-block; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: all 0.3s ease;">
              ✨ Verify My Email ✨
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center; margin: 20px 0;">
            <strong>⚠️ Important:</strong> This verification link will expire in 24 hours.
          </p>
          
          <!-- Alternative Link -->
          <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="color: #495057; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">
              If the button above doesn't work, copy and paste this link into your browser:
            </p>
            <p style="word-break: break-all; color: #007bff; font-size: 13px; margin: 0; font-family: monospace; background-color: #e3f2fd; padding: 10px; border-radius: 4px;">
              ${verificationLink}
            </p>
          </div>
          
          <!-- Next Steps -->
          <div style="background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #1976d2; margin: 0 0 15px 0; font-size: 18px;">🚀 What's Next?</h3>
            <ul style="color: #555; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>Verify your email (click the button above)</li>
              <li>Log in to your account</li>
              <li>Explore amazing destinations</li>
              <li>Book your next adventure!</li>
            </ul>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
          <p style="color: #6c757d; margin: 0; font-size: 14px;">
            Best regards,<br>
            <strong>The TripMe Team</strong>
          </p>
          <p style="color: #6c757d; margin: 10px 0 0 0; font-size: 12px;">
            If you didn't create this account, please ignore this email.
          </p>
        </div>
      </div>
    `
  }),

  passwordReset: (userName, resetLink) => ({
    subject: 'Reset Your TripMe Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">Password Reset Request</h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">Secure your account</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px 30px;">
          <h2 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 24px;">Hello ${userName}! 🔐</h2>
          
          <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            We received a request to reset your password. If this was you, click the button below to create a new secure password.
          </p>
          
          <!-- Reset Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 25px; display: inline-block; font-size: 16px; font-weight: 600; box-shadow: 0 4px 15px rgba(231, 76, 60, 0.4); transition: all 0.3s ease;">
              🔒 Reset My Password 🔒
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center; margin: 20px 0;">
            <strong>⚠️ Important:</strong> This reset link will expire in 1 hour.
          </p>
          
          <!-- Alternative Link -->
          <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="color: #495057; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">
              If the button above doesn't work, copy and paste this link into your browser:
            </p>
            <p style="word-break: break-all; color: #007bff; font-size: 13px; margin: 0; font-family: monospace; background-color: #e3f2fd; padding: 10px; border-radius: 4px;">
              ${resetLink}
            </p>
          </div>
          
          <!-- Security Notice -->
          <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="color: #856404; margin: 0 0 15px 0; font-size: 18px;">🔒 Security Notice</h3>
            <ul style="color: #856404; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>If you didn't request this password reset, please ignore this email</li>
              <li>Your current password will remain unchanged</li>
              <li>This link is only valid for 1 hour</li>
              <li>Contact support immediately if you suspect unauthorized access</li>
            </ul>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
          <p style="color: #6c757d; margin: 0; font-size: 14px;">
            Best regards,<br>
            <strong>The TripMe Team</strong>
          </p>
          <p style="color: #6c757d; margin: 10px 0 0 0; font-size: 12px;">
            For security reasons, please do not share this email with anyone.
          </p>
        </div>
      </div>
    `
  }),

  accountSuspended: (userName, suspensionDetails) => ({
    subject: 'Account Suspended - TripMe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e74c3c;">Account Suspended</h2>
        <p>Hello ${userName},</p>
        <p>Your TripMe account has been suspended by our administration team.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Suspension Details</h3>
          <p><strong>Reason:</strong> ${suspensionDetails.reason || 'Policy violation'}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Status:</strong> Account Suspended</p>
        </div>
        <p>During this suspension period, you will not be able to:</p>
        <ul style="color: #7f8c8d;">
          <li>Make new bookings</li>
          <li>List new properties (if you're a host)</li>
          <li>Access certain platform features</li>
        </ul>
        <p>If you believe this suspension was made in error, please contact our support team.</p>
        <p>Best regards,<br>The TripMe Team</p>
      </div>
    `
  }),

  accountActivated: (userName, activationDetails) => ({
    subject: 'Account Reactivated - TripMe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #27ae60;">Account Reactivated!</h2>
        <p>Hello ${userName},</p>
        <p>Great news! Your TripMe account has been reactivated by our administration team.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Account Status</h3>
          <p><strong>Status:</strong> Account Active</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Access:</strong> Full platform access restored</p>
        </div>
        <p>You now have full access to all TripMe features:</p>
        <ul style="color: #27ae60;">
          <li>Make new bookings</li>
          <li>List properties (if you're a host)</li>
          <li>Access all platform features</li>
        </ul>
        <p>Welcome back to TripMe!</p>
        <p>Best regards,<br>The TripMe Team</p>
      </div>
    `
  }),
  bookingCancellation: (userName, cancellationDetails) => ({
    subject: 'Booking Cancelled - TripMe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e74c3c;">Booking Cancelled</h2>
        <p>Hello ${userName},</p>
        <p>Your booking has been cancelled successfully.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Booking Details</h3>
          <p><strong>Property:</strong> ${cancellationDetails.propertyName}</p>
          <p><strong>Booking ID:</strong> ${cancellationDetails.bookingId}</p>
          <p><strong>Check-in:</strong> ${new Date(cancellationDetails.checkIn).toLocaleDateString()}</p>
          <p><strong>Check-out:</strong> ${new Date(cancellationDetails.checkOut).toLocaleDateString()}</p>
        </div>
        ${cancellationDetails.refundAmount > 0 ? `
        <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #155724;">Refund Information</h3>
          <p><strong>Refund Amount:</strong> ₹${cancellationDetails.refundAmount}</p>
          <p><strong>Refund Percentage:</strong> ${cancellationDetails.refundPercentage}%</p>
          <p><em>Refunds typically take 5-7 business days to appear in your account.</em></p>
        </div>
        ` : `
        <div style="background-color: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #721c24;">No Refund Available</h3>
          <p>Based on the cancellation policy, no refund is available for this booking.</p>
        </div>
        `}
        <p>If you have any questions about this cancellation, please contact our support team.</p>
        <p>Best regards,<br>The TripMe Team</p>
      </div>
    `
  }),

  bookingConfirmation: (userName, bookingDetails) => ({
    subject: 'Booking Request Submitted - TripMe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3498db;">Booking Request Submitted!</h2>
        <p>Hello ${userName},</p>
        <p>Your booking request has been successfully submitted. Here are the details:</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Booking Details</h3>
          <p><strong>Property:</strong> ${bookingDetails.propertyName}</p>
          <p><strong>Check-in:</strong> ${bookingDetails.checkIn}</p>
          <p><strong>Check-out:</strong> ${bookingDetails.checkOut}</p>
          <p><strong>Guests:</strong> ${bookingDetails.guests}</p>
          <p><strong>Total Amount:</strong> ₹${bookingDetails.totalAmount}</p>
          <p><strong>Booking ID:</strong> ${bookingDetails.bookingId}</p>
        </div>
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="color: #856404; margin: 0 0 10px 0;">⏳ What Happens Next?</h4>
          <p style="color: #856404; margin: 0;">
            <strong>Your booking is currently pending host approval.</strong> We will notify you via email once the host accepts your booking request.
          </p>
        </div>
        <p>Thank you for choosing TripMe! We'll keep you updated on your booking status.</p>
        <p>Best regards,<br>The TripMe Team</p>
      </div>
    `
  }),

  newReview: (userName, reviewDetails) => ({
    subject: 'New Review Received - TripMe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f39c12;">New Review Received!</h2>
        <p>Hello ${userName},</p>
        <p>You have received a new review for your property.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Review Details</h3>
          <p><strong>Property:</strong> ${reviewDetails.propertyName}</p>
          <p><strong>Rating:</strong> ${reviewDetails.rating}/5</p>
          <p><strong>Comment:</strong> ${reviewDetails.comment}</p>
          <p><strong>Reviewer:</strong> ${reviewDetails.reviewerName}</p>
        </div>
        <p>Thank you for being a great host!</p>
        <p>Best regards,<br>The TripMe Team</p>
      </div>
    `
  }),

  paymentSuccess: (userName, paymentDetails) => ({
    subject: 'Payment Successful - TripMe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #27ae60;">Payment Successful!</h2>
        <p>Hello ${userName},</p>
        <p>Your payment has been processed successfully.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Payment Details</h3>
          <p><strong>Amount:</strong> ₹${paymentDetails.amount}</p>
          <p><strong>Transaction ID:</strong> ${paymentDetails.transactionId}</p>
          <p><strong>Payment Method:</strong> ${paymentDetails.paymentMethod}</p>
          <p><strong>Date:</strong> ${paymentDetails.date}</p>
        </div>
        <p>Thank you for using TripMe!</p>
        <p>Best regards,<br>The TripMe Team</p>
      </div>
    `
  }),

  // Host Action Email Templates
  hostCancelledBooking: (userName, cancellationDetails) => ({
    subject: 'Booking Cancelled by Host - TripMe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e74c3c;">⚠️ Host Action: Booking Cancelled</h2>
        <p>Hello ${userName},</p>
        <p><strong>This is a host action notification.</strong> Your host has cancelled your booking.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Booking Details</h3>
          <p><strong>Property:</strong> ${cancellationDetails.propertyName}</p>
          <p><strong>Booking ID:</strong> ${cancellationDetails.bookingId}</p>
          <p><strong>Check-in:</strong> ${new Date(cancellationDetails.checkIn).toLocaleDateString()}</p>
          <p><strong>Check-out:</strong> ${new Date(cancellationDetails.checkOut).toLocaleDateString()}</p>
          <p><strong>Cancelled by:</strong> <span style="color: #e74c3c; font-weight: bold;">HOST</span></p>
          <p><strong>Cancellation reason:</strong> ${cancellationDetails.reason || 'Host decision'}</p>
        </div>
        ${cancellationDetails.refundAmount > 0 ? `
        <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #155724;">Refund Information</h3>
          <p><strong>Refund Amount:</strong> ₹${cancellationDetails.refundAmount}</p>
          <p><strong>Refund Percentage:</strong> ${cancellationDetails.refundPercentage}%</p>
          <p><em>Refunds typically take 5-7 business days to appear in your account.</em></p>
        </div>
        ` : `
        <div style="background-color: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #721c24;">No Refund Available</h3>
          <p>Based on the cancellation policy, no refund is available for this booking.</p>
        </div>
        `}
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="color: #856404; margin: 0 0 10px 0;">📧 Need Help?</h4>
          <p style="color: #856404; margin: 0;">
            If you have any questions about this host cancellation, please contact our support team. We're here to help you find alternative accommodations.
          </p>
        </div>
        <p>Best regards,<br>The TripMe Team</p>
      </div>
    `
  }),

  hostConfirmedBooking: (userName, confirmationDetails) => ({
    subject: 'Booking Confirmed by Host - TripMe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #27ae60;">✅ Host Action: Booking Confirmed!</h2>
        <p>Hello ${userName},</p>
        <p><strong>This is a host action notification.</strong> Your host has confirmed your booking request!</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Booking Details</h3>
          <p><strong>Property:</strong> ${confirmationDetails.propertyName}</p>
          <p><strong>Booking ID:</strong> ${confirmationDetails.bookingId}</p>
          <p><strong>Check-in:</strong> ${new Date(confirmationDetails.checkIn).toLocaleDateString()}</p>
          <p><strong>Check-out:</strong> ${new Date(confirmationDetails.checkOut).toLocaleDateString()}</p>
          <p><strong>Confirmed by:</strong> <span style="color: #27ae60; font-weight: bold;">HOST</span></p>
          <p><strong>Total Amount:</strong> ₹${confirmationDetails.totalAmount}</p>
        </div>
        <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #155724;">🎉 What's Next?</h3>
          <p style="color: #155724;">
            Your booking is now confirmed! Please ensure your payment is completed before the check-in date.
            You can contact your host directly for any specific arrangements or questions.
          </p>
        </div>
        <p>Thank you for choosing TripMe! We hope you have a wonderful stay.</p>
        <p>Best regards,<br>The TripMe Team</p>
      </div>
    `
  }),

  hostCompletedBooking: (userName, completionDetails) => ({
    subject: 'Booking Marked as Completed by Host - TripMe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3498db;">🏁 Host Action: Stay Completed</h2>
        <p>Hello ${userName},</p>
        <p><strong>This is a host action notification.</strong> Your host has marked your stay as completed.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Stay Details</h3>
          <p><strong>Property:</strong> ${completionDetails.propertyName}</p>
          <p><strong>Booking ID:</strong> ${completionDetails.bookingId}</p>
          <p><strong>Check-in:</strong> ${new Date(completionDetails.checkIn).toLocaleDateString()}</p>
          <p><strong>Check-out:</strong> ${new Date(completionDetails.checkOut).toLocaleDateString()}</p>
          <p><strong>Completed by:</strong> <span style="color: #3498db; font-weight: bold;">HOST</span></p>
        </div>
        <div style="background-color: #e3f2fd; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #1565c0;">📝 Share Your Experience</h3>
          <p style="color: #1565c0;">
            We hope you enjoyed your stay! Please take a moment to leave a review for your host and the property.
            Your feedback helps other travelers make informed decisions.
          </p>
        </div>
        <p>Thank you for choosing TripMe!</p>
        <p>Best regards,<br>The TripMe Team</p>
      </div>
    `
  }),

  hostCheckInGuest: (userName, checkInDetails) => ({
    subject: 'Guest Checked In by Host - TripMe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #27ae60;">🏠 Host Action: Guest Checked In</h2>
        <p>Hello ${userName},</p>
        <p><strong>This is a host action notification.</strong> Your host has checked you in for your stay.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Check-in Details</h3>
          <p><strong>Property:</strong> ${checkInDetails.propertyName}</p>
          <p><strong>Booking ID:</strong> ${checkInDetails.bookingId}</p>
          <p><strong>Check-in Date:</strong> ${new Date(checkInDetails.checkInDate).toLocaleDateString()}</p>
          <p><strong>Check-in Time:</strong> ${checkInDetails.checkInTime}</p>
          <p><strong>Checked in by:</strong> <span style="color: #27ae60; font-weight: bold;">HOST</span></p>
          ${checkInDetails.notes ? `<p><strong>Host Notes:</strong> ${checkInDetails.notes}</p>` : ''}
        </div>
        <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #155724;">🎯 Enjoy Your Stay!</h3>
          <p style="color: #155724;">
            You're all set! If you need anything during your stay, don't hesitate to contact your host.
            We hope you have a wonderful time!
          </p>
        </div>
        <p>Best regards,<br>The TripMe Team</p>
      </div>
    `
  }),

  hostStatusUpdate: (userName, statusDetails) => ({
    subject: 'Booking Status Updated by Host - TripMe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f39c12;">🔄 Host Action: Status Update</h2>
        <p>Hello ${userName},</p>
        <p><strong>This is a host action notification.</strong> Your host has updated your booking status.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Status Update Details</h3>
          <p><strong>Property:</strong> ${statusDetails.propertyName}</p>
          <p><strong>Booking ID:</strong> ${statusDetails.bookingId}</p>
          <p><strong>Previous Status:</strong> ${statusDetails.previousStatus}</p>
          <p><strong>New Status:</strong> <span style="color: #f39c12; font-weight: bold;">${statusDetails.newStatus}</span></p>
          <p><strong>Updated by:</strong> <span style="color: #f39c12; font-weight: bold;">HOST</span></p>
          <p><strong>Update Date:</strong> ${new Date().toLocaleDateString()}</p>
          ${statusDetails.reason ? `<p><strong>Reason:</strong> ${statusDetails.reason}</p>` : ''}
        </div>
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4 style="color: #856404; margin: 0 0 10px 0;">ℹ️ What This Means</h4>
          <p style="color: #856404; margin: 0;">
            Your host has made changes to your booking. If you have any questions about this status update, 
            please contact your host directly or reach out to our support team.
          </p>
        </div>
        <p>Best regards,<br>The TripMe Team</p>
      </div>
    `
  }),

  supportTicket: (userName, ticketDetails) => ({
    subject: 'Support Ticket Received - TripMe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3498db;">Support Ticket Received</h2>
        <p>Hello ${userName},</p>
        <p>We have received your support ticket and will get back to you soon.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Ticket Details</h3>
          <p><strong>Ticket ID:</strong> ${ticketDetails.ticketId}</p>
          <p><strong>Subject:</strong> ${ticketDetails.subject}</p>
          <p><strong>Priority:</strong> ${ticketDetails.priority}</p>
          <p><strong>Status:</strong> ${ticketDetails.status}</p>
        </div>
        <p>We typically respond within 24 hours.</p>
        <p>Best regards,<br>The TripMe Team</p>
      </div>
    `
  }),

  newBookingNotification: (userName, bookingDetails) => ({
    subject: 'New Booking Received - TripMe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #27ae60;">New Booking!</h2>
        <p>Hello ${userName},</p>
        <p>You have received a new booking for your property.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3>Booking Details</h3>
          <p><strong>Property:</strong> ${bookingDetails.propertyName}</p>
          <p><strong>Guest:</strong> ${bookingDetails.guestName}</p>
          <p><strong>Check-in:</strong> ${bookingDetails.checkIn}</p>
          <p><strong>Check-out:</strong> ${bookingDetails.checkOut}</p>
          <p><strong>Guests:</strong> ${bookingDetails.guests}</p>
          <p><strong>Total Amount:</strong> ₹${bookingDetails.totalAmount}</p>
        </div>
        <p>Please review and respond to this booking request.</p>
        <p>Best regards,<br>The TripMe Team</p>
      </div>
    `
  }),

  newsletter: (userName, content) => ({
    subject: 'TripMe Newsletter',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">TripMe Newsletter</h2>
        <p>Hello ${userName},</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          ${content}
        </div>
        <p>Best regards,<br>The TripMe Team</p>
      </div>
    `
  })
};

// Send email function
const sendEmail = async (to, template, data = {}) => {
  try {
    const transporter = createTransporter();
    
    if (!emailTemplates[template]) {
      console.error(`Email template '${template}' not found. Available templates:`, Object.keys(emailTemplates));
      throw new Error(`Email template '${template}' not found`);
    }

    // Handle different template signatures
    let emailContent;
    
    if (template === 'welcome') {
      emailContent = emailTemplates[template](data.userName || 'User', data.link);
    } else if (template === 'passwordReset') {
      emailContent = emailTemplates[template](data.userName || 'User', data.link);
    } else {
      emailContent = emailTemplates[template](data.userName || 'User', data);
    }
    
    const mailOptions = {
      from: `"TripMe" <${process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@tripme.com'}>`,
      to: to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    };

    // If SMTP is not configured, return mock result for development
    if (!transporter) {
      return {
        messageId: `dev-${Date.now()}`,
        accepted: [to],
        rejected: [],
        response: 'Email logged to console (development mode)'
      };
    }

    const result = await transporter.sendMail(mailOptions);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    if (process.env.NODE_ENV === 'development') {
      return {
        messageId: `error-${Date.now()}`,
        accepted: [],
        rejected: [to],
        response: 'Email error logged (development mode)'
      };
    }
    throw error;
  }
};

// Send welcome email
const sendWelcomeEmail = async (email, userName, verificationLink) => {
  return sendEmail(email, 'welcome', { userName, link: verificationLink });
};

// Send password reset email
const sendPasswordResetEmail = async (email, userName, resetLink) => {
  return sendEmail(email, 'passwordReset', { userName, link: resetLink });
};

// Send booking confirmation email
const sendBookingConfirmationEmail = async (email, userName, bookingDetails) => {
  return sendEmail(email, 'bookingConfirmation', { userName, ...bookingDetails });
};

// Send booking cancellation email
const sendBookingCancellationEmail = async (email, userName, bookingDetails) => {
  return sendEmail(email, 'bookingCancellation', { userName, ...bookingDetails });
};

// Send new review notification email
const sendNewReviewEmail = async (email, userName, reviewDetails) => {
  return sendEmail(email, 'newReview', { userName, ...reviewDetails });
};

// Send payment success email
const sendPaymentSuccessEmail = async (email, userName, paymentDetails) => {
  return sendEmail(email, 'paymentSuccess', { userName, ...paymentDetails });
};

// Send support ticket confirmation email
const sendSupportTicketEmail = async (email, userName, ticketDetails) => {
  return sendEmail(email, 'supportTicket', { userName, ...ticketDetails });
};

// Send new booking notification to host
const sendNewBookingNotificationEmail = async (email, userName, bookingDetails) => {
  return sendEmail(email, 'newBookingNotification', { userName, ...bookingDetails });
};

// Host Action Email Functions
const sendHostCancelledBookingEmail = async (email, userName, cancellationDetails) => {
  return sendEmail(email, 'hostCancelledBooking', { userName, ...cancellationDetails });
};

const sendHostConfirmedBookingEmail = async (email, userName, confirmationDetails) => {
  return sendEmail(email, 'hostConfirmedBooking', { userName, ...confirmationDetails });
};

const sendHostCompletedBookingEmail = async (email, userName, completionDetails) => {
  return sendEmail(email, 'hostCompletedBooking', { userName, ...completionDetails });
};

const sendHostCheckInGuestEmail = async (email, userName, checkInDetails) => {
  return sendEmail(email, 'hostCheckInGuest', { userName, ...checkInDetails });
};

const sendHostStatusUpdateEmail = async (email, userName, statusDetails) => {
  return sendEmail(email, 'hostStatusUpdate', { userName, ...statusDetails });
};

// Send newsletter email
const sendNewsletterEmail = async (email, userName, content) => {
  return sendEmail(email, 'newsletter', { userName, content });
};

// Send account suspended email
const sendAccountSuspendedEmail = async (email, userName, suspensionDetails) => {
  return sendEmail(email, 'accountSuspended', { userName, ...suspensionDetails });
};

// Send account activated email
const sendAccountActivatedEmail = async (email, userName, activationDetails) => {
  return sendEmail(email, 'accountActivated', { userName, ...activationDetails });
};

// Send custom email
const sendCustomEmail = async (to, subject, htmlContent, textContent = null) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"TripMe" <${process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@tripme.com'}>`,
      to: to,
      subject: subject,
      html: htmlContent,
      text: textContent || htmlContent.replace(/<[^>]*>/g, '')
    };

    // If SMTP is not configured, log the email instead
    if (!transporter) {
      // In dev mode, just return a mock result
      return {
        messageId: `dev-custom-${Date.now()}`,
        accepted: [to],
        rejected: [],
        response: 'Custom email logged to console (development mode)'
      };
    }

    const result = await transporter.sendMail(mailOptions);
    return result;
  } catch (error) {
    console.error('Error sending custom email:', error);
    if (process.env.NODE_ENV === 'development') {
      return {
        messageId: `error-custom-${Date.now()}`,
        accepted: [],
        rejected: [to],
        response: 'Custom email error logged (development mode)'
      };
    }
    throw error;
  }
};

// Send bulk emails
const sendBulkEmails = async (recipients, template, data = {}) => {
  for (const recipient of recipients) {
    try {
      await sendEmail(recipient.email, template, {
        ...data,
        userName: recipient.name || 'User'
      });
    } catch (error) {
      console.error('Error sending bulk email:', error);
    }
  }
};

// Email verification
const verifyEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      return true; // Return true in development mode
    }
    
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('Error verifying email config:', error);
    return false;
  }
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
  sendNewReviewEmail,
  sendPaymentSuccessEmail,
  sendSupportTicketEmail,
  sendNewsletterEmail,
  sendAccountSuspendedEmail,
  sendAccountActivatedEmail,
  sendCustomEmail,
  sendBulkEmails,
  verifyEmailConfig,
  emailTemplates,
  // Host Action Email Functions
  sendHostCancelledBookingEmail,
  sendHostConfirmedBookingEmail,
  sendHostCompletedBookingEmail,
  sendHostCheckInGuestEmail,
  sendHostStatusUpdateEmail
};
