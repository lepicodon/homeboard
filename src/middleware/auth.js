const db = require('../config/db');

function authMiddleware(req, res, next) {
  // Always allow auth status and authenticate checks
  const publicPaths = ['/settings/auth-status', '/settings/authenticate'];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  try {
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    rows.forEach((r) => {
      settings[r.key] = r.value;
    });

    const isEnabled = settings.password_protection_enabled === '1' || settings.password_protection_enabled === 'true';
    const savedPassword = (settings.app_password || '').trim();

    if (isEnabled && savedPassword) {
      const clientPassword = req.headers['x-app-password'] || req.query.pw || '';
      if (clientPassword !== savedPassword) {
        return res.status(401).json({ error: 'Authentication required' });
      }
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = authMiddleware;
