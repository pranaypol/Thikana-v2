const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_ENABLED = Boolean(STRIPE_SECRET_KEY);

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

function makeMockPaymentReference() {
  return `MOCK-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}

router.post('/', async (req, res) => {
  try {
    const { amount, currency = 'INR', paymentMethod = 'pay_at_hotel' } = req.body;
    const parsedAmount = Number(amount);

    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than zero.' });
    }

    const method = normalizePaymentMethod(paymentMethod) || 'pay_at_hotel';
    const lowerCurrency = String(currency || 'INR').toLowerCase();

    if (method === 'pay_at_hotel') {
      return res.status(200).json({
        paid: false,
        provider: 'pay_at_hotel',
        status: 'pending',
        payment_reference: null,
        amount: parsedAmount,
        currency: lowerCurrency
      });
    }

    if ((method === 'credit_card' || method === 'debit_card') && STRIPE_ENABLED) {
      const body = new URLSearchParams();
      body.append('amount', Math.round(parsedAmount * 100).toString());
      body.append('currency', lowerCurrency);
      body.append('payment_method_types[]', 'card');
      body.append('payment_method', 'pm_card_visa');
      body.append('confirm', 'true');
      body.append('description', 'Thikana hotel booking payment');

      const response = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
      });
      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: data.error?.message || 'Stripe payment failed',
          details: data
        });
      }

      return res.status(200).json({
        paid: data.status === 'succeeded',
        provider: 'stripe',
        status: data.status,
        payment_reference: data.id,
        amount: parsedAmount,
        currency: lowerCurrency
      });
    }

    // Fallback mock payment for UPI / Net Banking or when Stripe is not configured.
    const provider = method === 'upi' ? 'upi' : method === 'net_banking' ? 'net_banking' : 'mock';
    return res.status(200).json({
      paid: true,
      provider,
      status: 'succeeded',
      payment_reference: makeMockPaymentReference(),
      amount: parsedAmount,
      currency: lowerCurrency
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Payment processing failed', details: err.message });
  }
});

module.exports = router;
