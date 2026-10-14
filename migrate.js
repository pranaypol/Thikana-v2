// dns-fix.js
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('./dns-fix');

const fs = require('fs');
const path = require('path');
const db = require('./db');

async function migrate() {
  await db.connectDB();

  const sourcePath = path.join(__dirname, 'bookings.json');
  if (!fs.existsSync(sourcePath)) {
    console.log('No bookings.json file found. Nothing to migrate.');
    process.exit(0);
  }

  const raw = fs.readFileSync(sourcePath, 'utf8');
  const data = JSON.parse(raw);
  const users = Array.isArray(data.users) ? data.users : [];
  const bookings = Array.isArray(data.bookings) ? data.bookings : [];

  let addedUsers = 0;
  let skippedUsers = 0;

  for (const user of users) {
    const added = await db.addUser(user);
    if (added) {
      addedUsers += 1;
    } else {
      skippedUsers += 1;
    }
  }

  let addedBookings = 0;
  let skippedBookings = 0;

  for (const booking of bookings) {
    try {
      await db.addBooking(booking);
      addedBookings += 1;
    } catch (error) {
      skippedBookings += 1;
      console.error(`Skipping booking ${booking.id || 'unknown'}: ${error.message}`);
    }
  }

  console.log(`Migration complete: ${addedUsers} users added, ${skippedUsers} users skipped; ${addedBookings} bookings added, ${skippedBookings} bookings skipped.`);
  process.exit(0);
}

migrate().catch(err => {
  console.error('Database migration failed:', err);
  process.exit(1);
});
