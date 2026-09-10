const $ = (sel) => document.querySelector(sel);

const searchForm = $('#searchForm');
const statusBar = $('#statusBar');
const resultsMeta = $('#resultsMeta');
const resultsGrid = $('#resultsGrid');

const bookingBackdrop = $('#bookingBackdrop');
const confirmBackdrop = $('#confirmBackdrop');
const myBookingsBackdrop = $('#myBookingsBackdrop');

let selectedHotelPrice = 2500;

// Default dates: today and tomorrow
(function setDefaultDates() {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const fmt = (d) => d.toISOString().split('T')[0];
  $('#checkIn').value = fmt(today);
  $('#checkOut').value = fmt(tomorrow);
})();

function showStatus(msg, isError = false) {
  statusBar.hidden = false;
  statusBar.textContent = msg;
  statusBar.classList.toggle('error', isError);
}
function hideStatus() { statusBar.hidden = true; }

function calculateNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diff = (end - start) / 86400000;
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

function updateBookingTotal() {
  const nights = calculateNights($('#bf_checkIn').value, $('#bf_checkOut').value);
  const rooms = Number($('#bf_rooms').value) || 1;
  const total = nights > 0 ? nights * rooms * selectedHotelPrice : 0;
  $('#bookingTotal').textContent = nights > 0
    ? `₹${selectedHotelPrice.toLocaleString('en-IN')} / night · Estimated total: ₹${total.toLocaleString('en-IN')} (${nights} night${nights > 1 ? 's' : ''}, ${rooms} room${rooms > 1 ? 's' : ''})`
    : 'Select check-in and check-out dates to see your total.';
  return total;
}

function hotelCardHTML(h) {
  const photoContent = h.photoUrl
    ? `<img src="${escapeAttr(h.photoUrl)}" alt="${escapeAttr(h.name)} photo" loading="lazy" />`
    : escapeHtml(h.name).charAt(0);

  const ratingHtml = h.rating != null
    ? `<span class="hotel-rating">${h.rating.toFixed(1)} ★</span>`
    : '';
  const ratingCountHtml = h.ratingCount ? `<span class="hotel-rating-count">(${h.ratingCount})</span>` : '';
  const priceHtml = h.pricePerNight ? `<span class="hotel-price">₹${h.pricePerNight.toLocaleString('en-IN')} / night</span>` : '';

  return `
    <article class="hotel-card">
      <div class="hotel-card-photo">${photoContent}</div>
      <div class="hotel-card-body">
        <h3 class="hotel-name">${escapeHtml(h.name)}</h3>
        <p class="hotel-address">${escapeHtml(h.address || 'Address not listed')}</p>
        <div class="hotel-meta">
          ${priceHtml}
          ${ratingHtml}
          ${ratingCountHtml}
        </div>
      </div>
      <div class="ticket-stub-divider"></div>
      <div class="hotel-card-footer">
        <button class="btn-book" data-place-id="${h.placeId}" data-name="${escapeAttr(h.name)}" data-address="${escapeAttr(h.address || '')}" data-price-per-night="${h.pricePerNight || 0}">Book stay</button>
        ${h.mapsUri ? `<a class="hotel-link" href="${h.mapsUri}" target="_blank" rel="noopener">View on map →</a>` : '<span></span>'}
      </div>
    </article>
  `;
}

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(str = '') { return escapeHtml(str).replace(/"/g, '&quot;'); }

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const city = $('#city').value.trim();
  if (!city) return;

  resultsGrid.innerHTML = '';
  resultsMeta.hidden = true;
  showStatus(`Searching live listings in ${city}…`);

  try {
    const res = await fetch(`/api/hotels?city=${encodeURIComponent(city)}`);
    const data = await res.json();

    if (!res.ok) {
      showStatus(data.error || 'Something went wrong fetching hotels.', true);
      return;
    }

    hideStatus();

    if (!data.hotels.length) {
      resultsGrid.innerHTML = `<div class="empty-state">No hotels found for "${escapeHtml(city)}". Try a different city name.</div>`;
      return;
    }

    resultsMeta.hidden = false;
    resultsMeta.textContent = `${data.count} stays found in ${data.city}`;
    resultsGrid.innerHTML = data.hotels.map(hotelCardHTML).join('');
  } catch (err) {
    showStatus('Could not reach the server. Is it running?', true);
  }
});

resultsGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-book');
  if (!btn) return;
  openBookingModal({
    placeId: btn.dataset.placeId,
    name: btn.dataset.name,
    address: btn.dataset.address,
    pricePerNight: Number(btn.dataset.pricePerNight) || 0
  });
});

function normalizePaymentMethod(value) {
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
  return aliases[String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')] || 'pay_at_hotel';
}

function openBookingModal(hotel) {
  $('#bf_placeId').value = hotel.placeId;
  $('#bf_hotelName').value = hotel.name;
  $('#bf_hotelAddress').value = hotel.address;
  $('#bookingModalTitle').textContent = hotel.name;
  $('#bookingModalAddress').textContent = hotel.address;
  $('#bf_pricePerNight').value = hotel.pricePerNight || 0;
  selectedHotelPrice = hotel.pricePerNight || 2500;

  $('#bf_checkIn').value = $('#checkIn').value;
  $('#bf_checkOut').value = $('#checkOut').value;
  $('#bf_rooms').value = 1;
  $('#bf_guests').value = $('#guests').value || 2;
  $('#bf_paymentMethod').value = 'credit_card';

  // Pre-populate guest info if user is logged in
  if (currentUser) {
    $('#bf_email').value = currentUser.email;
    $('#bf_name').value = currentUser.name;
    $('#bf_phone').value = '';
  } else {
    $('#bf_email').value = '';
    $('#bf_name').value = '';
    $('#bf_phone').value = '';
  }

  updateBookingTotal();
  bookingBackdrop.hidden = false;
}

$('#closeBookingModal').addEventListener('click', () => bookingBackdrop.hidden = true);
bookingBackdrop.addEventListener('click', (e) => { if (e.target === bookingBackdrop) bookingBackdrop.hidden = true; });

['#bf_checkIn', '#bf_checkOut', '#bf_rooms'].forEach(selector => {
  const element = document.querySelector(selector);
  if (element) {
    element.addEventListener('change', updateBookingTotal);
  }
});

$('#bookingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = updateBookingTotal();
  const paymentMethod = normalizePaymentMethod($('#bf_paymentMethod').value);

  if (!amount || amount <= 0) {
    alert('Please select valid check-in/check-out dates and room count.');
    return;
  }

  const paymentRes = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency: 'INR', paymentMethod })
  });
  const paymentData = await paymentRes.json();

  if (!paymentRes.ok) {
    alert(paymentData.error || 'Payment failed.');
    return;
  }

  if (!paymentData.paid && paymentMethod !== 'pay_at_hotel') {
    alert('Payment did not complete successfully. Please try again.');
    return;
  }

  const payload = {
    placeId: $('#bf_placeId').value,
    hotelName: $('#bf_hotelName').value,
    hotelAddress: $('#bf_hotelAddress').value,
    checkIn: $('#bf_checkIn').value,
    checkOut: $('#bf_checkOut').value,
    rooms: Number($('#bf_rooms').value),
    guests: Number($('#bf_guests').value),
    pricePerNight: selectedHotelPrice,
    totalAmount: amount,
    totalPrice: amount,
    guestName: $('#bf_name').value.trim(),
    guestEmail: $('#bf_email').value.trim(),
    guestPhone: $('#bf_phone').value.trim(),
    paymentMethod,
    paymentStatus: paymentData.status,
    paymentProvider: paymentData.provider,
    paymentReference: paymentData.payment_reference
  };

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Booking failed.');
      return;
    }

    bookingBackdrop.hidden = true;
    showConfirmation(data.booking);
    e.target.reset();
  } catch (err) {
    alert('Could not reach the server.');
  }
});

function showConfirmation(b) {
  $('#confirmTicket').innerHTML = `
    <div>Confirmation code: <span class="code">${b.confirmation_code}</span></div>
    <div>Hotel: ${escapeHtml(b.hotel_name)}</div>
    <div>Check-in: ${b.check_in} → Check-out: ${b.check_out}</div>
    <div>Rooms: ${b.rooms} · Guests: ${b.guests}</div>
    <div>Payment: ${escapeHtml(b.payment_method || 'Pay at Hotel')} · ${escapeHtml(b.payment_status || 'pending')}</div>
    <div>Reference: ${escapeHtml(b.payment_reference || 'N/A')}</div>
    <div>Booked under: ${escapeHtml(b.guest_email)}</div>
  `;
  confirmBackdrop.hidden = false;
}
$('#closeConfirmModal').addEventListener('click', () => confirmBackdrop.hidden = true);
$('#confirmDone').addEventListener('click', () => confirmBackdrop.hidden = true);
confirmBackdrop.addEventListener('click', (e) => { if (e.target === confirmBackdrop) confirmBackdrop.hidden = true; });

// My bookings
$('#myBookingsBtn').addEventListener('click', () => { myBookingsBackdrop.hidden = false; });
$('#closeMyBookings').addEventListener('click', () => myBookingsBackdrop.hidden = true);
myBookingsBackdrop.addEventListener('click', (e) => { if (e.target === myBookingsBackdrop) myBookingsBackdrop.hidden = true; });

$('#lookupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#lookupEmail').value.trim();
  const list = $('#myBookingsList');
  list.innerHTML = 'Loading…';

  try {
    const res = await fetch(`/api/bookings/${encodeURIComponent(email)}`);
    const data = await res.json();

    if (!data.bookings.length) {
      list.innerHTML = '<div class="empty-state">No bookings found for that email.</div>';
      return;
    }

    list.innerHTML = data.bookings.map(b => `
      <div class="mini-booking">
        <strong>${escapeHtml(b.hotel_name)}</strong><br>
        ${b.check_in} → ${b.check_out} · ${b.rooms} room(s), ${b.guests} guest(s)<br>
        Payment: ${escapeHtml(b.payment_method || 'Pay at Hotel')} · ${escapeHtml(b.payment_status || 'pending')}<br>
        Ref: ${escapeHtml(b.payment_reference || 'N/A')}<br>
        <span class="code">${b.confirmation_code}</span> · ${b.status}
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<div class="empty-state">Could not load bookings.</div>';
  }
});

// ========== Authentication ==========
let currentUser = null;
let authToken = null;

// Get token from localStorage
function loadAuthToken() {
  authToken = localStorage.getItem('authToken');
  return authToken;
}

// Save token to localStorage
function saveAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
}

// Check if user is logged in
async function checkAuth() {
  if (!authToken) {
    authToken = loadAuthToken();
  }
  
  if (!authToken) {
    updateAuthUI(null);
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      updateAuthUI(currentUser);
    } else {
      saveAuthToken(null);
      updateAuthUI(null);
    }
  } catch (err) {
    console.error('Auth check failed:', err);
    updateAuthUI(null);
  }
}

// Update navbar based on auth state
function updateAuthUI(user) {
  const authNav = $('#authNav');
  const userNav = $('#userNav');

  if (user) {
    authNav.hidden = true;
    userNav.hidden = false;
    $('#userNameDisplay').textContent = user.name;
  } else {
    authNav.hidden = false;
    userNav.hidden = true;
  }
}

// Navigate to login page
$('#loginBtn').addEventListener('click', () => {
  window.location.href = '/login.html';
});

// Navigate to register page
$('#registerBtn').addEventListener('click', () => {
  window.location.href = '/register.html';
});

// Logout
$('#logoutBtn').addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
  } catch (err) {
    console.error('Logout error:', err);
  }

  saveAuthToken(null);
  currentUser = null;
  updateAuthUI(null);
  alert('You have been signed out');
});

// Override myBookingsBtn to require auth
const originalMyBookingsBtn = $('#myBookingsBtn');
originalMyBookingsBtn.addEventListener('click', () => {
  if (!currentUser) {
    showStatus('Please sign in to view your bookings.', true);
    setTimeout(() => $('#loginBackdrop').hidden = false, 300);
    return;
  }
  $('#myBookingsBackdrop').hidden = false;
  $('#lookupEmail').value = currentUser.email;
  // Auto-submit to load their bookings
  $('#lookupForm').dispatchEvent(new Event('submit'));
});

// Check auth on page load
window.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});
