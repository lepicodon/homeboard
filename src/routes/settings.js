const express = require('express');
const settingsRouter = express.Router();
const weatherRouter = express.Router();
const db = require('../config/db');
const { URL } = require('url');
const crypto = require('crypto');
const zlib = require('zlib');
const path = require('path');

// In-memory weather forecast cache (keyed by city name lowercase)
const weatherCache = {};

// Settings endpoints
settingsRouter.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM settings').all();
    const settingsObj = {};
    rows.forEach((r) => {
      settingsObj[r.key] = r.value;
    });
    // Mask the weather API key if it's set
    if (settingsObj.weather_apikey) {
      settingsObj.weather_apikey = '******';
    }
    // Mask the app password if it's set
    if (settingsObj.app_password) {
      settingsObj.app_password = '******';
    }
    // Convert protection enabled to boolean
    settingsObj.password_protection_enabled =
      settingsObj.password_protection_enabled === '1' || settingsObj.password_protection_enabled === 'true';

    res.json(settingsObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

settingsRouter.put('/', (req, res) => {
  const {
    app_title,
    tasks_per_page,
    weather_apikey,
    password_protection_enabled,
    app_password,
    background_type,
    background_url
  } = req.body;
  if (!app_title || !tasks_per_page) {
    return res.status(400).json({ error: 'App Title and Tasks Per Page are required.' });
  }
  try {
    const updateTx = db.transaction(() => {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('app_title', app_title.trim());
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('tasks_per_page', tasks_per_page);
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'password_protection_enabled',
        password_protection_enabled ? '1' : '0'
      );

      // If the key is not masked, write it. Otherwise do not overwrite the existing key.
      if (weather_apikey !== '******') {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
          'weather_apikey',
          (weather_apikey || '').trim()
        );
      }

      // If the password is not masked, write it.
      if (app_password !== '******') {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
          'app_password',
          (app_password || '').trim()
        );
      }

      if (background_type !== undefined) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
          'background_type',
          background_type
        );
      }

      if (background_url !== undefined) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('background_url', background_url);
      }
    });
    updateTx();

    // Clear weather cache when API key or settings are updated
    Object.keys(weatherCache).forEach((k) => delete weatherCache[k]);

    const currentApiKey = db.prepare('SELECT value FROM settings WHERE key = ?').get('weather_apikey')?.value || '';
    const maskedApiKey = currentApiKey ? '******' : '';

    const currentPassword = db.prepare('SELECT value FROM settings WHERE key = ?').get('app_password')?.value || '';
    const maskedPassword = currentPassword ? '******' : '';

    res.json({
      app_title: app_title.trim(),
      tasks_per_page,
      weather_apikey: maskedApiKey,
      password_protection_enabled: !!password_protection_enabled,
      app_password: maskedPassword,
      background_type: background_type || 'none',
      background_url: background_url || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authentication Status Check
settingsRouter.get('/auth-status', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    rows.forEach((r) => (settings[r.key] = r.value));

    const isEnabled = settings.password_protection_enabled === '1' || settings.password_protection_enabled === 'true';
    const hasPassword = !!(settings.app_password || '').trim();

    // Check if the client header credentials match the stored password
    const clientPassword = req.headers['x-app-password'] || '';
    const isValid = !isEnabled || !hasPassword || clientPassword === settings.app_password;

    res.json({
      enabled: isEnabled && hasPassword,
      authenticated: isValid
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authenticate Simple Password
settingsRouter.post('/authenticate', (req, res) => {
  const { password } = req.body;
  try {
    const storedPassword = db.prepare("SELECT value FROM settings WHERE key = 'app_password'").get()?.value || '';
    if ((password || '').trim() === storedPassword) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Incorrect password' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const fs = require('fs');

// GET background image
settingsRouter.get('/background', (req, res) => {
  const filePath = '/data/background.jpg';
  if (fs.existsSync(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'No custom background active.' });
  }
});

// POST save background image from base64
settingsRouter.post('/background', (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image data is required.' });
  }
  try {
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync('/data/background.jpg', buffer);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save background image: ' + err.message });
  }
});

const dns = require('dns').promises;

function isPrivateIP(ipAddress) {
  if (!ipAddress || ipAddress === '::1' || ipAddress === '0.0.0.0') return true;
  const parts = ipAddress.split('.');
  if (parts.length === 4) {
    const first = parseInt(parts[0], 10);
    const second = parseInt(parts[1], 10);
    if (first === 10) return true;
    if (first === 127) return true;
    if (first === 192 && second === 168) return true;
    if (first === 169 && second === 254) return true;
    if (first === 172 && second >= 16 && second <= 31) return true;
  }
  return false;
}

async function isSafeUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname;
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return false;
    }

    let addresses = [];
    try {
      addresses = await dns.resolve(hostname);
    } catch {
      try {
        const lookup = await dns.lookup(hostname);
        addresses = [lookup.address];
      } catch {
        addresses = [hostname];
      }
    }

    for (const addr of addresses) {
      if (isPrivateIP(addr)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// POST proxy external image download
settingsRouter.post('/background/fetch-external', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required.' });
  }
  try {
    if (!(await isSafeUrl(url))) {
      return res.status(400).json({ error: 'Restricted URL: Only public URLs are allowed.' });
    }
    const imageRes = await fetch(url);
    if (!imageRes.ok) {
      throw new Error(`Failed to fetch image: HTTP ${imageRes.status}`);
    }
    const contentType = imageRes.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new Error('Fetched URL is not an image');
    }
    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    res.json({ contentType, data: base64 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch image: ' + err.message });
  }
});

// DELETE clear background image
settingsRouter.delete('/background', (req, res) => {
  const filePath = '/data/background.jpg';
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete background: ' + err.message });
  }
});

// Weather Locations CRUD

// 1. Get all weather locations
weatherRouter.get('/locations', (req, res) => {
  try {
    const locations = db.prepare('SELECT * FROM weather_locations ORDER BY id ASC').all();
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Add weather location
weatherRouter.post('/locations', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'City name is required.' });
  }
  try {
    const info = db.prepare('INSERT INTO weather_locations (name) VALUES (?)').run(name.trim());
    res.status(201).json({ id: info.lastInsertRowid, name: name.trim() });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'City location already exists.' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// 3. Delete weather location
weatherRouter.delete('/locations/:id', (req, res) => {
  const { id } = req.params;
  try {
    const info = db.prepare('DELETE FROM weather_locations WHERE id = ?').run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Location not found.' });
    }
    res.json({ message: 'Location deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Set weather location as home
weatherRouter.put('/locations/:id/set-home', (req, res) => {
  const { id } = req.params;
  try {
    const updateTx = db.transaction(() => {
      db.prepare('UPDATE weather_locations SET is_home = 0').run();
      const info = db.prepare('UPDATE weather_locations SET is_home = 1 WHERE id = ?').run(id);
      if (info.changes === 0) {
        throw new Error('Location not found.');
      }
    });
    updateTx();
    res.json({ message: 'Home location updated successfully.' });
  } catch (err) {
    if (err.message === 'Location not found.') {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// Weather forecast endpoint
weatherRouter.get('/', async (req, res) => {
  try {
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

    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
    const cached = weatherCache[city.toLowerCase()];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
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

    // Store in cache
    weatherCache[city.toLowerCase()] = {
      current: curData,
      forecast: forecastData,
      timestamp: Date.now()
    };

    res.json({
      configured: true,
      current: curData,
      forecast: forecastData
    });
  } catch (err) {
    console.error(`[Weather] Unexpected weather API error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST DB Backup
settingsRouter.post('/backup', async (req, res) => {
  const { password } = req.body;
  const dbDir = path.dirname(db.name);
  const tempPath = path.join(dbDir, `temp_backup_${Date.now()}.db`);
  try {
    await db.backup(tempPath);
    const dbBuffer = fs.readFileSync(tempPath);
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    const compressed = zlib.gzipSync(dbBuffer);
    let finalBuffer = compressed;
    let filename = `homeboard_backup_${new Date().toISOString().slice(0, 10)}.db.gz`;

    if (password && password.trim()) {
      const salt = crypto.randomBytes(16);
      const key = crypto.scryptSync(password.trim(), salt, 32, { N: 16384, r: 8, p: 1 });
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
      const authTag = cipher.getAuthTag();

      const header = Buffer.from('HBENC');
      finalBuffer = Buffer.concat([header, salt, iv, authTag, ciphertext]);
      filename += '.enc';
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(finalBuffer);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Ignore cleanup failure
      }
    }
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Failed to create backup: ' + err.message });
  }
});

// POST DB Restore
settingsRouter.post('/restore', async (req, res) => {
  const { file, password } = req.body;
  if (!file) {
    return res.status(400).json({ error: 'Backup file data is required.' });
  }

  const dbDir = path.dirname(db.name);
  const tempRestorePath = path.join(dbDir, `temp_restore_${Date.now()}.db`);
  try {
    const fileBuffer = Buffer.from(file, 'base64');
    let decryptedBuffer;

    const header = fileBuffer.subarray(0, 5).toString();
    if (header === 'HBENC') {
      if (!password || !password.trim()) {
        return res.status(400).json({ error: 'PASSWORD_REQUIRED' });
      }

      const salt = fileBuffer.subarray(5, 21);
      const iv = fileBuffer.subarray(21, 33);
      const authTag = fileBuffer.subarray(33, 49);
      const ciphertext = fileBuffer.subarray(49);

      try {
        const key = crypto.scryptSync(password.trim(), salt, 32, { N: 16384, r: 8, p: 1 });
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        decryptedBuffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      } catch {
        return res.status(400).json({ error: 'INCORRECT_PASSWORD' });
      }
    } else {
      decryptedBuffer = fileBuffer;
    }

    let dbBuffer;
    try {
      dbBuffer = zlib.gunzipSync(decryptedBuffer);
    } catch {
      return res.status(400).json({ error: 'Invalid file format. Ensure it is a valid backup file.' });
    }

    if (dbBuffer.subarray(0, 16).toString() !== 'SQLite format 3\0') {
      return res.status(400).json({ error: 'Not a valid SQLite database file.' });
    }

    fs.writeFileSync(tempRestorePath, dbBuffer);
    db.closeAndReplace(tempRestorePath);

    if (fs.existsSync(tempRestorePath)) {
      fs.unlinkSync(tempRestorePath);
    }

    res.json({ success: true });
  } catch (err) {
    if (fs.existsSync(tempRestorePath)) {
      try {
        fs.unlinkSync(tempRestorePath);
      } catch {
        // Ignore cleanup failure
      }
    }
    console.error('Restore error:', err);
    res.status(500).json({ error: 'Failed to restore database: ' + err.message });
  }
});

module.exports = {
  settingsRouter,
  weatherRouter
};
