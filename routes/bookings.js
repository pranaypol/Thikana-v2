const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { ratePerNightForPlace, nightsBetween } = require('../utils/pricing');
const { sendBookingConfirmationEmail } = require('../utils/email');

const router = express.Router();

const VALID_PAYMENT_METHODS = ['credit_card', 'debit_card', 'upi', 'net_banking', 'pay_at_hotel'];

function normalizePaymentMethod(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliases = {
    credit_card: 'credit_card',
    debit_card: 'debit_card',
    upi: 'upi',
    net_banking: 'net_banking',
    pay_at_hotel: 'pay_at_hotel',
    'credit card': 'credit_card',
    'debit card': 'debit_card',
    'net banking': 'net_banking',
    'pay at hotel': 'pay_at_hotel'
  };
  return aliases[normalized] || null;
}

function genConfirmationCode() {
  return 'IN' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * POST /api/bookings
 * Body: { placeId, hotelName, hotelAddress, guestName, guestEmail, guestPhone,
 *         checkIn, checkOut, rooms, guests, paymentMethod }
 * Writes a confirmed booking row to the SQLite database.
 *
 * The booking amount should follow the estimated total shown to the guest.
 * If the client sends an estimate, we use that value; otherwise we fall back
 * to the server-side calculation for compatibility.
 */
router.post('/', (req, res) => {
  try {
    const {
      placeId, hotelName, hotelAddress,
      guestName, guestEmail, guestPhone,
      checkIn, checkOut, rooms = 1, guests = 1,
      paymentMethod = 'pay_at_hotel',
      paymentStatus,
      paymentProvider,
      paymentReference,
      pricePerNight: clientPricePerNight,
      totalAmount: clientTotalAmount,
      totalPrice: clientTotalPrice
    } = req.body;

    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

    if (!placeId || !hotelName || !guestName || !guestEmail || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'placeId, hotelName, guestName, guestEmail, checkIn and checkOut are required' });
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      return res.status(400).json({ error: 'checkOut must be after checkIn' });
    }
    const roomCount = Number(rooms);
    if (!Number.isInteger(roomCount) || roomCount < 1) {
      return res.status(400).json({ error: 'rooms must be a positive integer' });
    }
    if (!normalizedPaymentMethod || !VALID_PAYMENT_METHODS.includes(normalizedPaymentMethod)) {
      return res.status(400).json({ error: `paymentMethod must be one of: ${VALID_PAYMENT_METHODS.join(', ')}` });
    }

    const requestedRatePerNight = Number(clientPricePerNight);
    const ratePerNight = Number.isFinite(requestedRatePerNight) && requestedRatePerNight > 0
      ? requestedRatePerNight
      : ratePerNightForPlace(placeId);
    const nights = nightsBetween(checkIn, checkOut);
    const computedTotalAmount = ratePerNight * roomCount * nights;
    const estimatedTotalAmount = Number(clientTotalAmount ?? clientTotalPrice ?? computedTotalAmount);
    const totalAmount = Number.isFinite(estimatedTotalAmount) && estimatedTotalAmount > 0
      ? estimatedTotalAmount
      : computedTotalAmount;

    const id = uuidv4();
    const confirmationCode = genConfirmationCode();

    // If `db` exposes an `addBooking` function (the JSON-backed store),
    // create a booking object and save it there. Otherwise fall back to
    // the SQL `prepare` path used by the original code.
    if (typeof db.addBooking === 'function') {
      const booking = {
        id,
        confirmation_code: confirmationCode,
        place_id: placeId,
        hotel_name: hotelName,
        hotel_address: hotelAddress || null,
        guest_name: guestName,
        guest_email: guestEmail,
        guest_phone: guestPhone || null,
        check_in: checkIn,
        check_out: checkOut,
        rooms: roomCount,
        guests,
        rate_per_night: ratePerNight,
        nights,
        total_amount: totalAmount,
        payment_method: normalizedPaymentMethod,
        payment_status: paymentStatus || (normalizedPaymentMethod === 'pay_at_hotel' ? 'pending' : 'succeeded'),
        payment_provider: paymentProvider || (normalizedPaymentMethod === 'pay_at_hotel' ? 'pay_at_hotel' : 'mock'),
        payment_reference: paymentReference || null,
        status: 'confirmed',
        created_at: new Date().toISOString()
      };

      db.addBooking(booking);
      
      // Send confirmation email asynchronously (don't wait for it)
      sendBookingConfirmationEmail(booking).catch(err => 
        console.error('Email sending error (non-blocking):', err.message)
      );
      
      return res.status(201).json({ message: 'Booking confirmed', booking });
    }

    // Fallback to SQL insertion for environments using better-sqlite3
    const stmt = db.prepare(`
      INSERT INTO bookings
        (id, confirmation_code, place_id, hotel_name, hotel_address,
         guest_name, guest_email, guest_phone, check_in, check_out, rooms, guests,
         rate_per_night, nights, total_amount, payment_method, payment_status, payment_provider, payment_reference)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id, confirmationCode, placeId, hotelName, hotelAddress || null,
      guestName, guestEmail, guestPhone || null, checkIn, checkOut, roomCount, guests,
      ratePerNight, nights, totalAmount, normalizedPaymentMethod,
      paymentStatus || (normalizedPaymentMethod === 'pay_at_hotel' ? 'pending' : 'succeeded'),
      paymentProvider || (normalizedPaymentMethod === 'pay_at_hotel' ? 'pay_at_hotel' : 'mock'),
      paymentReference || null
    );

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    
    // Send confirmation email asynchronously (don't wait for it)
    if (booking) {
      sendBookingConfirmationEmail(booking).catch(err => 
        console.error('Email sending error (non-blocking):', err.message)
      );
    }
    
    res.status(201).json({ message: 'Booking confirmed', booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking', details: err.message });
  }
});

/** GET /api/bookings/:email — list bookings for a guest */
router.get('/:email', (req, res) => {
  try {
    const bookings = db.getBookingsByEmail(req.params.email);
    res.json({ count: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings', details: err.message });
  }
});

/** DELETE /api/bookings/:id — cancel a booking */
router.delete('/:id', (req, res) => {
  try {
    const info = db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel booking', details: err.message });
  }
});

module.exports = router;