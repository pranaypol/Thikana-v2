const fetch = require('node-fetch');
const key = process.env.GEOAPIFY_API_KEY || '45259e4fce914dab962b5996fe1aaf61';
(async () => {
  try {
    const city = 'Mumbai';
    const geo = await fetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(city + ', India')}&type=city&format=json&apiKey=${key}`);
    const geoData = await geo.json();
    console.log('geo status', geo.status);
    const result = (geoData.results || [])[0];
    console.log('first city result keys:', Object.keys(result || {}));
    const pid = result?.place_id;
    console.log('placeId', pid);
    const url = `https://api.geoapify.com/v2/places?categories=accommodation.hotel,accommodation.guest_house,accommodation.hostel&filter=place:${pid}&limit=5&apiKey=${key}`;
    const places = await fetch(url);
    const placesData = await places.json();
    console.log('places status', places.status);
    console.log('features count', (placesData.features || []).length);
    for (const f of placesData.features.slice(0, 3)) {
      console.log('---');
      console.log('name', f.properties.name);
      console.log('keys', Object.keys(f.properties));
      console.log('rate', f.properties.rate, 'rating', f.properties.rating, 'rating_count', f.properties.rating_count, 'media', JSON.stringify(f.properties.media));
    }
  } catch (err) {
    console.error('ERROR', err);
  }
})();
