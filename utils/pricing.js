function ratePerNightForPlace(placeId) {
  if (!placeId) return 2500;

  let hash = 0;
  for (let i = 0; i < placeId.length; i += 1) {
    hash = (hash * 31 + placeId.charCodeAt(i)) >>> 0;
  }

  const base = 1800 + (hash % 7) * 250;
  return Math.max(1800, base);
}

function nightsBetween(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diff = (end - start) / 86400000;
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

module.exports = {
  ratePerNightForPlace,
  nightsBetween
};
