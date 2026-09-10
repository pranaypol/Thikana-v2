# Thikana — India Hotel Booking

A full-stack hotel search & booking app:

- **Live hotel data** for any Indian city via the **Google Places API** (plus Google Geocoding to resolve the city).
- **Real database** (SQLite, via `better-sqlite3`) that stores confirmed bookings with a unique confirmation code.
- Plain HTML/CSS/JS frontend, Node.js + Express backend.

## ⚠️ Important — what this app can and can't do

This app gives you **real hotel listings** and a **real booking record in your own database** (name, dates, confirmation code, etc. — genuinely persisted, queryable, cancellable).

It does **not** place an actual reservation into a hotel's own front-desk / PMS system, and it does **not** take payment. No public API lets you do that directly — real booking flows (Booking.com, MakeMyTrip, Goibibo, Expedia) require a signed commercial partnership with an OTA or hotel chain, plus PCI-compliant payment processing (e.g. Razorpay/Stripe). If you want that, the next step is applying for API access with one of those providers and wiring their booking + payment endpoints into the `bookings.js` route.

Listings come from Google Places, so you get name, address, coordinates, phone/website, star ratings, and a photo where available.

## Setup

1. **Get a Google API key**
   - Go to the [Google Cloud Console](https://console.cloud.google.com) → create/select a project.
   - Enable the **Places API** and **Geocoding API** for that project.
   - Go to "APIs & Services" → "Credentials" → "Create credentials" → "API key".
   - Copy the generated key. (Billing must be enabled on the project, though Google's free monthly credit covers typical dev/test usage.)

2. **Configure environment**
   ```bash
   cp .env.example .env
   # then edit .env and paste your key:
   # GOOGLE_API_KEY=your_key_here
   ```

3. **Install & run**
   ```bash
   npm install
   npm start
   ```
   Visit **http://localhost:3000**

## How it works

- `GET /api/hotels?city=Jaipur` → geocodes the city via Google's Geocoding API to get coordinates, then queries Google Places' Nearby Search for lodging around that point. Returns name, address, coordinates, rating, phone/website, and a photo where available. City lookups are cached in memory to save API calls on repeat searches.
- `POST /api/bookings` → validates and writes a booking row into `bookings.db` (SQLite), returns a generated confirmation code.
- `GET /api/bookings/:email` → looks up all bookings for a guest.
- `DELETE /api/bookings/:id` → marks a booking cancelled.

## Project structure

```
hotel-booking-app/
├── server.js           # Express app entry point
├── db.js                # SQLite connection + schema
├── routes/
│   ├── hotels.js         # Google Places integration
│   └── bookings.js       # Booking CRUD against the database
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── .env.example
└── package.json
```

## Deploying

- Any Node host works (Render, Railway, Fly.io, a VPS). Set `GOOGLE_API_KEY` as an environment variable on the host — don't commit `.env`.
- `bookings.db` is a file — for production-scale traffic, swap `better-sqlite3` for Postgres/MySQL (the `db.js` + `bookings.js` boundary is intentionally thin so this is a small change).

## Extending to real payments/reservations

If you later get OTA/hotel API access:
1. Add a payment step in `bookingForm` (Razorpay/Stripe checkout) before hitting `POST /api/bookings`.
2. In `routes/bookings.js`, after your own DB insert, call the partner's reservation-create endpoint and store their returned reservation ID alongside `confirmation_code`.
3. Handle partner webhooks (payment success/failure, reservation cancellation) to keep your `status` column in sync.
