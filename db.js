const fs = require('fs');
const path = require('path');

const dbFile = process.env.BOOKING_STORE_PATH
  ? path.resolve(process.env.BOOKING_STORE_PATH)
  : path.join(__dirname, 'bookings.json');
let dbData = { bookings: [], users: [] };

fs.mkdirSync(path.dirname(dbFile), { recursive: true });

if (fs.existsSync(dbFile)) {
  const raw = fs.readFileSync(dbFile, 'utf8');
  dbData = JSON.parse(raw);
  if (!dbData || !Array.isArray(dbData.bookings)) {
    throw new Error(`Booking store at ${dbFile} must contain a bookings array.`);
  }
  if (!Array.isArray(dbData.users)) dbData.users = [];
}

function saveDb() {
  const tempFile = `${dbFile}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(dbData, null, 2), 'utf8');
    fs.renameSync(tempFile, dbFile);
  } catch (err) {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    throw err;
  }
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
