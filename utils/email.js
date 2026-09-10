const nodemailer = require('nodemailer');

// Initialize transporter
let transporter = null;

function initializeTransporter() {
  // Check if Gmail credentials are available
  if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });
  } else {
    // Fallback to development mode (no email sending)
    transporter = {
      sendMail: async (mailOptions) => {
        console.log('📧 [DEV MODE] Email would be sent:', {
          to: mailOptions.to,
          subject: mailOptions.subject,
          text: mailOptions.text.substring(0, 100) + '...'
        });
        return { messageId: 'dev-mode-' + Date.now() };
      }
    };
  }
  return transporter;
}

/**
 * Send booking confirmation email
 * @param {Object} booking - Booking object with guest details
 * @returns {Promise}
 */
async function sendBookingConfirmationEmail(booking) {
  try {
    if (!transporter) {
      initializeTransporter();
    }

    const {
      confirmation_code,
      hotel_name,
      hotel_address,
      guest_name,
      guest_email,
      check_in,
      check_out,
      rooms,
      rate_per_night,
      total_amount
    } = booking;

    // Format dates
    const checkInDate = new Date(check_in).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const checkOutDate = new Date(check_out).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const mailOptions = {
      from: process.env.GMAIL_USER || 'noreply@thikana.com',
      to: guest_email,
      subject: `🏨 Booking Confirmation - ${hotel_name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 4px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 20px 0; }
            .booking-details { background: #f9f9f9; padding: 15px; border-radius: 4px; margin: 15px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-row:last-child { border-bottom: none; }
            .label { font-weight: bold; color: #555; }
            .confirmation-code { font-size: 20px; font-weight: bold; color: #667eea; text-align: center; padding: 10px; background: #f0f0f0; border-radius: 4px; margin: 15px 0; }
            .footer { text-align: center; color: #888; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
            .btn { display: inline-block; background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🏨 Booking Confirmed!</h1>
            </div>
            
            <div class="content">
              <p>Dear <strong>${guest_name}</strong>,</p>
              
              <p>Thank you for booking with <strong>Thikana</strong>! Your reservation has been confirmed.</p>
              
              <div class="booking-details">
                <div class="detail-row">
                  <span class="label">Confirmation Code:</span>
                  <span>${confirmation_code}</span>
                </div>
                
                <div class="detail-row">
                  <span class="label">Hotel:</span>
                  <span>${hotel_name}</span>
                </div>
                
                <div class="detail-row">
                  <span class="label">Address:</span>
                  <span>${hotel_address || 'N/A'}</span>
                </div>
                
                <div class="detail-row">
                  <span class="label">Check-in:</span>
                  <span>${checkInDate}</span>
                </div>
                
                <div class="detail-row">
                  <span class="label">Check-out:</span>
                  <span>${checkOutDate}</span>
                </div>
                
                <div class="detail-row">
                  <span class="label">Number of Rooms:</span>
                  <span>${rooms}</span>
                </div>
                
                <div class="detail-row">
                  <span class="label">Rate per Night:</span>
                  <span>₹${rate_per_night.toLocaleString('en-IN')}</span>
                </div>
                
                <div class="detail-row">
                  <span class="label">Total Amount:</span>
                  <span style="font-weight: bold; color: #667eea; font-size: 16px;">₹${total_amount.toLocaleString('en-IN')}</span>
                </div>
              </div>
              
              <div class="confirmation-code">
                Confirmation #${confirmation_code}
              </div>
              
              <p>Please keep your confirmation code safe. You'll need it at check-in.</p>
              
              <p>If you have any questions or need to modify your booking, please visit your account page on Thikana or contact us.</p>
              
              <p style="text-align: center;">
                <a href="http://localhost:3000/" class="btn">Visit Thikana</a>
              </p>
            </div>
            
            <div class="footer">
              <p>© 2026 Thikana Hotel Booking. All rights reserved.</p>
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Booking Confirmation - ${hotel_name}

Dear ${guest_name},

Thank you for booking with Thikana! Your reservation has been confirmed.

BOOKING DETAILS:
Confirmation Code: ${confirmation_code}
Hotel: ${hotel_name}
Address: ${hotel_address || 'N/A'}
Check-in: ${checkInDate}
Check-out: ${checkOutDate}
Number of Rooms: ${rooms}
Rate per Night: ₹${rate_per_night.toLocaleString('en-IN')}
Total Amount: ₹${total_amount.toLocaleString('en-IN')}

Please keep your confirmation code safe. You'll need it at check-in.

If you have any questions or need to modify your booking, please visit your account page on Thikana or contact us.

Best regards,
Thikana Hotel Booking Team

---
© 2026 Thikana Hotel Booking. All rights reserved.
This is an automated email. Please do not reply to this message.
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Confirmation email sent to:', guest_email);
    return result;
  } catch (error) {
    console.error('❌ Failed to send confirmation email:', error.message);
    // Don't throw - allow booking to succeed even if email fails
    return { error: error.message };
  }
}

module.exports = {
  sendBookingConfirmationEmail,
  initializeTransporter
};
