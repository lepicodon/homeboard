const express = require('express');
const router = express.Router();
const db = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');

// Constants
const WEATHER_CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
const MAX_WEATHER_CACHE_SIZE = 50;

// In-memory weather forecast cache (keyed by city name lowercase)
const weatherCache = new Map();

// Weather Locations CRUD

// 1. Get all weather locations
router.get('/locations', asyncHandler(async (req, res) => {
  const locations = db.prepare('SELECT * FROM weather_locations ORDER BY id ASC').all();
  res.json(locations);
}));

// 2. Add weather location
router.post('/locations', asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'City name is required.' });
  }
  const trimmedName = name.trim();
  if (trimmedName.length > 100) {
    return res.status(400).json({ error: 'City name cannot exceed 100 characters.' });
  }
  
  try {
    const info = db.prepare('INSERT INTO weather_locations (name) VALUES (?)').run(trimmedName);
    res.status(201).json({ id: info.lastInsertRowid, name: trimmedName });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'City location already exists.' });
    } else {
      throw err;
    }
  }
}));

// 3. Delete weather location
router.delete('/locations/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const info = db.prepare('DELETE FROM weather_locations WHERE id = ?').run(id);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Location not found.' });
  }
  res.json({ message: 'Location deleted successfully.' });
}));

// 4. Set weather location as home
router.put('/locations/:id/set-home', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateTx = db.transaction(() => {
    db.prepare('UPDATE weather_locations SET is_home = 0').run();
    const info = db.prepare('UPDATE weather_locations SET is_home = 1 WHERE id = ?').run(id);
    if (info.changes === 0) {
      throw new Error('Location not found.');
    }
  });
  
  try {
    updateTx();
    res.json({ message: 'Home location updated successfully.' });
  } catch (err) {
    if (err.message === 'Location not found.') {
      res.status(404).json({ error: err.message });
    } else {
      throw err;
    }
  }
}));

// Weather forecast endpoint
router.get('/', asyncHandler(async (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach((r) => (settings[r.key] = r.value));

  const apiKey = settings.weather_apikey;
  const locationId = req.query.location_id ? parseInt(req.query.location_id) : null;
  const isHome = req.query.is_home === 'true';
  let city = '';

  if (isHome) {
    const loc =
      db.prepare('SELECT name FROM weather_locations WHERE is_home = 1').get() ||
      db.prepare('SELECT name FROM weather_locations ORDER BY id ASC LIMIT 1').get();
    if (loc) city = loc.name;
  } else if (locationId) {
    const loc = db.prepare('SELECT name FROM weather_locations WHERE id = ?').get(locationId);
    if (loc) city = loc.name;
  } else {
    const loc = db.prepare('SELECT name FROM weather_locations ORDER BY id ASC LIMIT 1').get();
    if (loc) city = loc.name;
  }

  if (!city || !apiKey) {
    return res.json({ configured: false });
  }

  const cached = weatherCache.get(city.toLowerCase());
  if (cached && Date.now() - cached.timestamp < WEATHER_CACHE_DURATION_MS) {
    console.log(`[Weather] Serving cached forecast for city: "${city}"`);
    return res.json({
      configured: true,
      current: cached.current,
      forecast: cached.forecast
    });
  }

  console.log(`[Weather] Fetching weather forecast for city: "${city}"`);

  const curUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
  const curRes = await fetch(curUrl);
  if (!curRes.ok) {
    console.error(`[Weather] Current weather fetch failed for city "${city}" with status: ${curRes.status}`);
    return res
      .status(curRes.status)
      .json({ error: `OpenWeatherMap current weather query failed (Status: ${curRes.status})` });
  }
  const curData = await curRes.json();

  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
  const forecastRes = await fetch(forecastUrl);
  if (!forecastRes.ok) {
    console.error(`[Weather] Forecast weather fetch failed for city "${city}" with status: ${forecastRes.status}`);
    return res
      .status(forecastRes.status)
      .json({ error: `OpenWeatherMap forecast query failed (Status: ${forecastRes.status})` });
  }
  const forecastData = await forecastRes.json();

  // Store in cache with bounded size limit (evicts oldest entry if capacity reached)
  if (weatherCache.size >= MAX_WEATHER_CACHE_SIZE) {
    const oldestKey = weatherCache.keys().next().value;
    weatherCache.delete(oldestKey);
  }
  weatherCache.set(city.toLowerCase(), {
    current: curData,
    forecast: forecastData,
    timestamp: Date.now()
  });

  res.json({
    configured: true,
    current: curData,
    forecast: forecastData
  });
}));

module.exports = router;
