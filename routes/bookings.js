const express = require('express');
const crypto = require('crypto');
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
 * Writes a confirmed booking to the configured MongoDB store.
 *
 * The booking amount should follow the estimated total shown to the guest.
 * If the client sends an estimate, we use that value; otherwise we fall back
 * to the server-side calculation for compatibility.
 */
router.post('/', async (req, res) => {
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

    await db.addBooking(booking);

    sendBookingConfirmationEmail(booking).catch(err =>
      console.error('Email sending error (non-blocking):', err.message)
    );

    return res.status(201).json({ message: 'Booking confirmed', booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create booking', details: err.message });
  }
});

router.get('/admin/all', async (req, res) => {
  const expectedToken = process.env.ADMIN_BOOKINGS_TOKEN;
  if (!expectedToken) {
    return res.status(503).json({ error: 'Admin booking access is not configured.' });
  }

  const authorization = req.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match) {
    return res.status(401).json({ error: 'Admin authorization required.' });
  }

  const providedToken = Buffer.from(match[1], 'utf8');
  const configuredToken = Buffer.from(expectedToken, 'utf8');
  if (
    providedToken.length !== configuredToken.length ||
    !crypto.timingSafeEqual(providedToken, configuredToken)
  ) {
    return res.status(401).json({ error: 'Invalid admin token.' });
  }

  try {
    res.json(await db.getAllBookings());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings', details: err.message });
  }
});

/** GET /api/bookings/:email ? list bookings for a guest */
router.get('/:email', async (req, res) => {
  try {
    const bookings = await db.getBookingsByEmail(req.params.email);
    res.json({ count: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings', details: err.message });
  }
});

/** DELETE /api/bookings/:id ? cancel a booking */
router.delete('/:id', async (req, res) => {
  try {
    const cancelled = await db.cancelBooking(req.params.id);
    if (!cancelled) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to cancel booking', details: err.message });
  }
});

module.exports = router;