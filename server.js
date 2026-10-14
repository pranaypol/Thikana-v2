const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

// ...then your other requires



require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const hotelsRouter = require('./routes/hotels');
const bookingsRouter = require('./routes/bookings');
const paymentsRouter = require('./routes/payments');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRouter);
app.use('/api/hotels', hotelsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/bookings', bookingsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', googleApiKeyConfigured: !!process.env.GOOGLE_API_KEY });
});

async function startServer() {
  await db.connectDB();
  app.listen(PORT, () => {
    console.log(`🏨 India Hotel Booking server running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Database connection error:', err);
  process.exit(1);
});
