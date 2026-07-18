const crypto = require('crypto');

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LEN = 32;
const PBKDF2_ALGO = 'sha256';

/**
 * Hashes a password using PBKDF2.
 * Returns string format: $pbkdf2$iterations$saltHex$hashHex
 */
function hashPassword(password) {
  if (typeof password !== 'string') return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(
    password.trim(),
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LEN,
    PBKDF2_ALGO
  ).toString('hex');
  return `$pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

/**
 * Verifies a password against a stored password (hashed or plain-text).
 */
function verifyPassword(password, storedPassword) {
  if (!storedPassword || storedPassword.trim() === '') {
    return (password || '').trim() === '';
  }
  
  if (storedPassword.startsWith('$pbkdf2$')) {
    const parts = storedPassword.split('$');
    if (parts.length !== 5) return false;
    
    const iterations = parseInt(parts[2], 10);
    const salt = parts[3];
    const storedHash = parts[4];
    
    const hash = crypto.pbkdf2Sync(
      password.trim(),
      salt,
      iterations,
      PBKDF2_KEY_LEN,
      PBKDF2_ALGO
    ).toString('hex');
    
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  }
  
  // Fallback for legacy plain-text passwords
  return password.trim() === storedPassword;
}

/**
 * Checks if a stored password needs migration to the hashed format.
 */
function needsMigration(storedPassword) {
  if (!storedPassword || storedPassword.trim() === '') return false;
  return !storedPassword.startsWith('$pbkdf2$');
}

module.exports = {
  hashPassword,
  verifyPassword,
  needsMigration
};
