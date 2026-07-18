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
      const clientPassword = req.headers['x-app-password'] || '';
      const { verifyPassword, hashPassword, needsMigration } = require('../config/password');
      
      if (!verifyPassword(clientPassword, savedPassword)) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Auto-migrate legacy plain-text password on successful login
      if (needsMigration(savedPassword)) {
        try {
          const hashedPassword = hashPassword(clientPassword);
          db.prepare("UPDATE settings SET value = ? WHERE key = 'app_password'").run(hashedPassword);
          console.log('[Auth] Migrated plain-text password to PBKDF2 hash.');
        } catch (migrationErr) {
          console.error('[Auth] Failed to auto-migrate legacy password:', migrationErr);
        }
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authMiddleware;
