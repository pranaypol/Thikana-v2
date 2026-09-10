const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, 'bookings.json');
let dbData = { bookings: [], users: [] };

if (fs.existsSync(dbFile)) {
  try {
    const raw = fs.readFileSync(dbFile, 'utf8');
    dbData = JSON.parse(raw);
    if (!dbData.users) dbData.users = [];
  } catch (err) {
    console.warn('Unable to read bookings.json, starting with an empty store.', err.message);
    dbData = { bookings: [], users: [] };
  }
}

function saveDb() {
  fs.writeFileSync(dbFile, JSON.stringify(dbData, null, 2), 'utf8');
}

module.exports = {
  getBookingsByEmail(email) {
    return dbData.bookings.filter(b => b.guest_email === email);
  },

  getBookingById(id) {
    return dbData.bookings.find(b => b.id === id) || null;
  },

  addBooking(booking) {
    dbData.bookings.unshift(booking);
    saveDb();
  },

  cancelBooking(id) {
    const booking = dbData.bookings.find(b => b.id === id);
    if (!booking) return false;
    booking.status = 'cancelled';
    saveDb();
    return true;
  },

  // User management functions
  getUserByEmail(email) {
    return dbData.users.find(u => u.email === email) || null;
  },

  addUser(user) {
    if (dbData.users.some(u => u.email === user.email)) {
      return false; // User already exists
    }
    dbData.users.push(user);
    saveDb();
    return true;
  },

  updateUser(email, updates) {
    const user = dbData.users.find(u => u.email === email);
    if (!user) return false;
    Object.assign(user, updates);
    saveDb();
    return true;
  }
};
