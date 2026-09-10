const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Small in-memory cache so repeat searches for the same city don't burn extra
// API credits. Resets when the server restarts.
const cityCoordinatesCache = new Map();

/** Geocode a city name to coordinates using Google Geocoding API. */
async function getCityCoordinates(city) {
  const cacheKey = city.toLowerCase().trim();
  if (cityCoordinatesCache.has(cacheKey)) return cityCoordinatesCache.get(cacheKey);

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city + ', India')}&key=${GOOGLE_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error(data.error_message || 'Geocoding failed');
  }

  const result = data.results[0];
  if (!result) return null;

  const coordinates = {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng
  };

  cityCoordinatesCache.set(cacheKey, coordinates);
  return coordinates;
}

/**
 * GET /api/hotels?city=Mumbai
 * Uses Google Places API to fetch real hotels in an Indian city.
 */
router.get('/', async (req, res) => {
  try {
    const { city } = req.query;
    if (!city) {
      return res.status(400).json({ error: 'Query param "city" is required, e.g. ?city=Jaipur' });
    }
    if (!GOOGLE_API_KEY) {
      return res.status(500).json({ error: 'Server is missing GOOGLE_API_KEY. Add it to your .env file.' });
    }

    const coordinates = await getCityCoordinates(city);
    if (!coordinates) {
      return res.json({ city, count: 0, hotels: [] });
    }

    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coordinates.lat},${coordinates.lng}&radius=15000&type=lodging&keyword=hotel&key=${GOOGLE_API_KEY}`;
    const response = await fetch(placesUrl);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return res.status(500).json({ error: data.error_message || 'Google Places API error', details: data });
    }

    // Fetch details for each hotel to get photos
    const hotels = await Promise.all((data.results || []).map(async (place, idx) => {
      const priceLevel = place.price_level || null;
      const priceBase = priceLevel
        ? [1800, 2600, 3400, 4600, 6200][Math.min(Math.max(priceLevel, 1), 5) - 1]
        : 1800 + ((idx % 5) * 700);
      const pricePerNight = Math.round(priceBase + ((idx % 3) * 250));

      let photoUrl = null;
      
      // Fetch detailed info including photos
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=photos&key=${GOOGLE_API_KEY}`;
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();
        
        if (detailsData.result && detailsData.result.photos && detailsData.result.photos[0]) {
          photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&maxheight=300&photoreference=${detailsData.result.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`;
        }
      } catch (photoErr) {
        console.warn(`Could not fetch photo for ${place.name}:`, photoErr.message);
      }

      // Fallback: use static map if no photo
      if (!photoUrl) {
        photoUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${place.geometry.location.lat},${place.geometry.location.lng}&zoom=15&size=400x300&markers=color:red%7C${place.geometry.location.lat},${place.geometry.location.lng}&key=${GOOGLE_API_KEY}`;
      }

      return {
        placeId: place.place_id,
        name: place.name || 'Unnamed Hotel',
        address: place.vicinity || 'Address not available',
        rating: place.rating || null,
        ratingCount: place.user_ratings_total || 0,
        pricePerNight,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`,
        phone: place.formatted_phone_number || null,
        website: place.website || null,
        photoUrl
      };
    }));

    res.json({ city, count: hotels.length, hotels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch hotels', details: err.message });
  }
});

module.exports = router;
