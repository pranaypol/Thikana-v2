# Thikana — India Hotel Booking

A full-stack hotel search & booking app:

- **Live hotel data** for any Indian city via the **Google Places API** (plus Google Geocoding to resolve the city).
- **User accounts** (register/login) with a simple in-memory session token.
- **Real bookings**, stored in a local JSON file (`bookings.json`) with a unique confirmation code.
- **Payments**: Stripe-aware, but falls back to a mock payment reference for "pay at hotel" or when no Stripe key is configured.
- **Email confirmations** via Gmail (nodemailer) — logs to console instead of sending if no Gmail credentials are set.
- Plain HTML/CSS/JS frontend, Node.js + Express backend.

## ⚠️ Important — what this app can and can't do

This app gives you **real hotel listings** and a **real booking record in your own store** (name, dates, confirmation code, etc. — genuinely persisted, queryable, cancellable).

It does **not** place an actual reservation into a hotel's own front-desk / PMS system, and it does **not** process real payments unless you fully wire up Stripe (current payment route mocks a reference for pay-at-hotel and when no Stripe key is present). No public API lets you book into real OTA inventory directly — real booking flows (Booking.com, MakeMyTrip, Goibibo, Expedia) require a signed commercial partnership with an OTA or hotel chain, plus PCI-compliant payment processing (e.g. Razorpay/Stripe). If you want that, the next step is applying for API access with one of those providers and wiring their booking + payment endpoints into the `bookings.js` route.

Listings come from Google Places, so you get name, address, coordinates, phone/website, star ratings, and a photo where available.

## Setup

1. **Get a Google API key**
   - Go to the [Google Cloud Console](https://console.cloud.google.com) → create/select a project.
   - Enable the **Places API** and **Geocoding API** for that project.
   - Go to "APIs & Services" → "Credentials" → "Create credentials" → "API key".
   - Copy the generated key. (Billing must be enabled on the project, though Google's free monthly credit covers typical dev/test usage.)

2. **(Optional) Get a Stripe key** — only needed if you want real card payments instead of the mock reference. Get it from the [Stripe Dashboard](https://dashboard.stripe.com/apikeys).

3. **(Optional) Get a Gmail App Password** — only needed to actually send confirmation emails instead of logging them. Enable 2-Step Verification on your Google Account, then create one at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).

4. **Configure environment**
   ```bash
   cp .env.example .env
   # then edit .env and paste your values:
   # GOOGLE_API_KEY=your_key_here
   # STRIPE_SECRET_KEY=your_key_here      (optional)
   # GMAIL_USER=you@gmail.com             (optional)
   # GMAIL_PASS=your_16_char_app_password (optional)
   ```

5. **Install & run**
   ```bash
   npm install
   npm start
   ```
   Visit **http://localhost:3000**

## How it works

- `GET /api/hotels?city=Jaipur` → geocodes the city via Google's Geocoding API to get coordinates, then queries Google Places' Nearby Search for lodging around that point. Returns name, address, coordinates, rating, phone/website, and a photo where available. City lookups are cached in memory to save API calls on repeat searches.
- `POST /api/auth/register`, `POST /api/auth/login` → creates/authenticates a user, returns a session token (in-memory `Map`, demo-grade — not a production auth setup).
- `POST /api/payments` → validates the payment method and amount; returns a mock payment reference for pay-at-hotel or when Stripe isn't configured.
- `POST /api/bookings` → validates and writes a booking into `bookings.json`, returns a generated confirmation code, and sends (or logs) a confirmation email.
- `GET /api/bookings/:email` → looks up all bookings for a guest.
- `DELETE /api/bookings/:id` → marks a booking cancelled.

## Project structure

```
Thikana/
├── server.js             # Express app entry point
├── db.js                 # JSON-file data store (bookings.json) + user/booking helpers
├── routes/
│   ├── hotels.js          # Google Places/Geocoding integration
│   ├── auth.js             # Register/login, in-memory sessions
│   ├── payments.js         # Stripe-aware payment handling with mock fallback
│   └── bookings.js         # Booking CRUD against the JSON store
├── utils/
│   ├── pricing.js           # Deterministic per-hotel nightly rate + nights calculation
│   └── email.js              # Gmail (nodemailer) booking confirmations, console fallback
├── public/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── style.css
│   └── app.js
├── .env.example
└── package.json
```

## Deploying

- Any Node host works (Render, Railway, Fly.io, a VPS). Set `GOOGLE_API_KEY` (and optionally `STRIPE_SECRET_KEY`, `GMAIL_USER`, `GMAIL_PASS`) as environment variables on the host — don't commit `.env`.
- `bookings.json` is a plain file on disk — fine for a demo/college project, but it won't survive across redeploys or scale to concurrent writers. For production-scale traffic, swap `db.js` for a real database (Postgres/MySQL/SQLite), keeping the same function signatures (`getBookingsByEmail`, `addBooking`, etc.) so the rest of the app doesn't need to change.

## Extending to real payments/reservations

If you later get OTA/hotel API access:
1. Replace the mock reference in `routes/payments.js` with a real Stripe Checkout/PaymentIntent flow.
2. In `routes/bookings.js`, after your own store write, call the partner's reservation-create endpoint and store their returned reservation ID alongside `confirmation_code`.
3. Handle partner webhooks (payment success/failure, reservation cancellation) to keep your `status` field in sync.
