const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

// ...then your other requires
const express = require('express');
const connectDB = require('./db'); // or however you load it

const mongoose = require('mongoose');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'users'
});

const bookingSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  confirmation_code: {
    type: String,
    required: true,
    index: true
  },
  place_id: {
    type: String,
    required: true
  },
  hotel_name: {
    type: String,
    required: true
  },
  hotel_address: {
    type: String,
    default: null
  },
  guest_name: {
    type: String,
    required: true
  },
  guest_email: {
    type: String,
    required: true,
    index: true,
    lowercase: true,
    trim: true
  },
  guest_phone: {
    type: String,
    default: null
  },
  check_in: {
    type: String,
    required: true
  },
  check_out: {
    type: String,
    required: true
  },
  rooms: {
    type: Number,
    default: 1
  },
  guests: {
    type: Number,
    default: 1
  },
  rate_per_night: {
    type: Number,
    required: true
  },
  nights: {
    type: Number,
    required: true
  },
  total_amount: {
    type: Number,
    required: true
  },
  payment_method: {
    type: String,
    required: true
  },
  payment_status: {
    type: String,
    default: 'pending'
  },
  payment_provider: {
    type: String,
    default: 'mock'
  },
  payment_reference: {
    type: String,
    default: null
  },
  status: {
    type: String,
    default: 'confirmed'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'bookings'
});

const User = mongoose.model('User', userSchema);
const Booking = mongoose.model('Booking', bookingSchema);

module.exports = {
  async connectDB() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not configured. Add it to your .env file.');
    }
    if (/cluster0\.xxxxx\.mongodb\.net|<[^>]+>/i.test(mongoUri)) {
      throw new Error(
        'MONGODB_URI still contains an example placeholder. Replace it with the connection string for your MongoDB Atlas cluster.'
      );
    }

    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    await mongoose.connect(mongoUri);
    console.log('📦 Connected to MongoDB Atlas');
    return mongoose.connection;
  },

  async getBookingsByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return [];

    const bookings = await Booking.find({ guest_email: normalizedEmail }).sort({ created_at: -1 }).lean();
    return bookings;
  },

  async getBookingById(id) {
    return Booking.findOne({ id }).lean();
  },

  async addBooking(booking) {
    const doc = await Booking.create(booking);
    return doc.toObject();
  },

  async cancelBooking(id) {
    const updated = await Booking.findOneAndUpdate(
      { id },
      { $set: { status: 'cancelled' } },
      { new: true }
    );
    return Boolean(updated);
  },

  async getAllBookings() {
    const bookings = await Booking.find({}).sort({ created_at: -1 }).lean();
    return { count: bookings.length, bookings };
  },

  async getUserByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;

    return User.findOne({ email: normalizedEmail }).lean();
  },

  async addUser(user) {
    try {
      await User.create({
        ...user,
        email: normalizeEmail(user.email),
        name: user.name,
        password: user.password
      });
      return true;
    } catch (err) {
      if (err && err.code === 11000) {
        return false;
      }
      throw err;
    }
  },

  async updateUser(email, updates) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return false;

    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      { $set: updates },
      { new: true }
    );

    return Boolean(user);
  }
};
