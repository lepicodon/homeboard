const express = require('express');
const router = express.Router();
const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const dns = require('dns').promises;
const http = require('http');
const https = require('https');
const asyncHandler = require('../middleware/asyncHandler');

// In-memory weather forecast cache (only used for settings router updates if needed, though they are now in weather.js)
// We still need the getBackgroundPath helper.
const getBackgroundPath = () => {
  const dbDir = path.dirname(db.name);
  return path.join(dbDir, 'background.jpg');
};

// GET Settings
router.get('/', asyncHandler(async (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settingsObj = {};
  rows.forEach((r) => {
    settingsObj[r.key] = r.value;
  });
  
  // Mask sensitive values
  if (settingsObj.weather_apikey) {
    settingsObj.weather_apikey = '******';
  }
  if (settingsObj.app_password) {
    settingsObj.app_password = '******';
  }
  settingsObj.password_protection_enabled =
    settingsObj.password_protection_enabled === '1' || settingsObj.password_protection_enabled === 'true';

  res.json(settingsObj);
}));

// PUT Settings
router.put('/', asyncHandler(async (req, res) => {
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

  const updateTx = db.transaction(() => {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('app_title', app_title.trim());
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('tasks_per_page', tasks_per_page);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'password_protection_enabled',
      password_protection_enabled ? '1' : '0'
    );

    if (weather_apikey !== '******') {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'weather_apikey',
        (weather_apikey || '').trim()
      );
    }

    if (app_password !== '******') {
      const { hashPassword } = require('../config/password');
      const rawPassword = (app_password || '').trim();
      const storedPassword = rawPassword ? hashPassword(rawPassword) : '';
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'app_password',
        storedPassword
      );
    }

    if (background_type !== undefined) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('background_type', background_type);
    }

    if (background_url !== undefined) {
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('background_url', background_url);
    }
  });

  updateTx();

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
}));

// Authentication Status Check
router.get('/auth-status', asyncHandler(async (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach((r) => (settings[r.key] = r.value));

  const isEnabled = settings.password_protection_enabled === '1' || settings.password_protection_enabled === 'true';
  const hasPassword = !!(settings.app_password || '').trim();

  const clientPassword = req.headers['x-app-password'] || '';
  const { verifyPassword, hashPassword, needsMigration } = require('../config/password');
  const isValid = !isEnabled || !hasPassword || verifyPassword(clientPassword, settings.app_password);

  // Auto-migrate if password matches and is in legacy plain-text format
  if (isEnabled && hasPassword && isValid && needsMigration(settings.app_password)) {
    try {
      const hashedPassword = hashPassword(clientPassword);
      db.prepare("UPDATE settings SET value = ? WHERE key = 'app_password'").run(hashedPassword);
      console.log('[Auth Status] Migrated legacy password to PBKDF2 hash.');
    } catch (migrationErr) {
      console.error('[Auth Status] Failed to auto-migrate legacy password:', migrationErr);
    }
  }

  res.json({
    enabled: isEnabled && hasPassword,
    authenticated: isValid
  });
}));

// Authenticate Simple Password
router.post('/authenticate', asyncHandler(async (req, res) => {
  const { password } = req.body;
  const storedPassword = db.prepare("SELECT value FROM settings WHERE key = 'app_password'").get()?.value || '';
  const { verifyPassword, hashPassword, needsMigration } = require('../config/password');
  
  if (verifyPassword(password || '', storedPassword)) {
    // Auto-migrate on successful authentication
    if (needsMigration(storedPassword)) {
      try {
        const hashedPassword = hashPassword(password);
        db.prepare("UPDATE settings SET value = ? WHERE key = 'app_password'").run(hashedPassword);
        console.log('[Authenticate API] Migrated legacy password to PBKDF2 hash.');
      } catch (migrationErr) {
        console.error('[Authenticate API] Failed to auto-migrate legacy password:', migrationErr);
      }
    }
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Incorrect password' });
  }
}));

// GET background image
router.get('/background', asyncHandler(async (req, res) => {
  const filePath = getBackgroundPath();
  if (fs.existsSync(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'No custom background active.' });
  }
}));

// POST save background image from base64
router.post('/background', asyncHandler(async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image data is required.' });
  }
  const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(getBackgroundPath(), buffer);
  res.json({ success: true });
}));

function isPrivateIP(ipAddress) {
  if (!ipAddress || ipAddress === '::1' || ipAddress === '0.0.0.0' || ipAddress === '::') return true;
  
  if (ipAddress.includes(':')) {
    const cleanIp = ipAddress.toLowerCase();
    if (
      cleanIp.startsWith('fe8') ||
      cleanIp.startsWith('fe9') ||
      cleanIp.startsWith('fea') ||
      cleanIp.startsWith('feb') ||
      cleanIp.startsWith('fc') ||
      cleanIp.startsWith('fd')
    ) {
      return true;
    }
    if (cleanIp.startsWith('::ffff:')) {
      const ipv4Part = ipAddress.substring(7);
      return isPrivateIP(ipv4Part);
    }
    return false;
  }

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

function fetchSafeImage(urlString) {
  return new Promise(async (resolve, reject) => {
    try {
      const parsed = new URL(urlString);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return reject(new Error('Restricted URL: Only HTTP and HTTPS protocols are allowed.'));
      }
      const hostname = parsed.hostname;
      if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
        return reject(new Error('Restricted URL: Internal hostnames are not allowed.'));
      }

      let addresses = [];
      try {
        addresses = await dns.resolve(hostname);
      } catch {
        try {
          const lookup = await dns.lookup(hostname);
          addresses = [lookup.address];
        } catch (err) {
          return reject(new Error('DNS resolution failed: ' + err.message));
        }
      }

      if (addresses.length === 0) {
        return reject(new Error('No IP addresses resolved for hostname.'));
      }

      for (const addr of addresses) {
        if (isPrivateIP(addr)) {
          return reject(new Error('Restricted URL: Private/internal IP range detected.'));
        }
      }

      const safeIp = addresses[0];
      const client = parsed.protocol === 'https:' ? https : http;

      const req = client.request({
        method: 'GET',
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'HomeBoard-SSRF-Filter/1.0'
        },
        lookup: (host, opts, cb) => {
          cb(null, safeIp, safeIp.includes(':') ? 6 : 4);
        },
        timeout: 5000
      }, (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(new Error(`HTTP ${response.statusCode}`));
        }

        const contentType = response.headers['content-type'] || '';
        if (!contentType.startsWith('image/')) {
          return reject(new Error('Fetched URL is not an image'));
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            contentType,
            buffer: Buffer.concat(chunks)
          });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Connection timed out'));
      });

      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

// POST proxy external image download
router.post('/background/fetch-external', asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL is required.' });
  }
  try {
    const { contentType, buffer } = await fetchSafeImage(url);
    const base64 = buffer.toString('base64');
    res.json({ contentType, data: base64 });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

// DELETE clear background image
router.delete('/background', asyncHandler(async (req, res) => {
  const filePath = getBackgroundPath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  res.json({ success: true });
}));

module.exports = router;
