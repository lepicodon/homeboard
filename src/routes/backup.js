const express = require('express');
const router = express.Router();
const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const asyncHandler = require('../middleware/asyncHandler');

// Scrypt settings for backup encryption
const BACKUP_SCRYPT_N = 131072; // Increased to 131072 (2^17) for stronger encryption
const BACKUP_SCRYPT_N_LEGACY = 16384; // Stored for backward compatibility with older backups
const BACKUP_SCRYPT_R = 8;
const BACKUP_SCRYPT_P = 1;
const BACKUP_SCRYPT_KEY_LEN = 32;

// POST DB Backup
router.post('/backup', asyncHandler(async (req, res) => {
  const { password, compress } = req.body;
  const shouldCompress = compress !== false;
  const dbDir = path.dirname(db.name);
  const tempPath = path.join(dbDir, `temp_backup_${Date.now()}.db`);
  try {
    await db.backup(tempPath);
    const dbBuffer = fs.readFileSync(tempPath);
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    const processedBuffer = shouldCompress ? zlib.gzipSync(dbBuffer) : dbBuffer;
    let finalBuffer = processedBuffer;
    let filename = `homeboard_backup_${new Date().toISOString().slice(0, 10)}`;
    if (shouldCompress) {
      filename += '.db.gz';
    } else {
      filename += '.db';
    }

    if (password && password.trim()) {
      const salt = crypto.randomBytes(16);
      const key = crypto.scryptSync(password.trim(), salt, BACKUP_SCRYPT_KEY_LEN, {
        N: BACKUP_SCRYPT_N,
        r: BACKUP_SCRYPT_R,
        p: BACKUP_SCRYPT_P,
        maxmem: 256 * 1024 * 1024
      });
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([cipher.update(processedBuffer), cipher.final()]);
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
}));

// POST DB Restore
router.post('/restore', asyncHandler(async (req, res) => {
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
        const key = crypto.scryptSync(password.trim(), salt, BACKUP_SCRYPT_KEY_LEN, {
          N: BACKUP_SCRYPT_N,
          r: BACKUP_SCRYPT_R,
          p: BACKUP_SCRYPT_P,
          maxmem: 256 * 1024 * 1024
        });
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        decryptedBuffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      } catch {
        // Fallback: attempt decryption using legacy work factor N
        try {
          const key = crypto.scryptSync(password.trim(), salt, BACKUP_SCRYPT_KEY_LEN, {
            N: BACKUP_SCRYPT_N_LEGACY,
            r: BACKUP_SCRYPT_R,
            p: BACKUP_SCRYPT_P,
            maxmem: 256 * 1024 * 1024
          });
          const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
          decipher.setAuthTag(authTag);
          decryptedBuffer = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        } catch {
          return res.status(400).json({ error: 'INCORRECT_PASSWORD' });
        }
      }
    } else {
      decryptedBuffer = fileBuffer;
    }

    let dbBuffer;
    if (decryptedBuffer[0] === 0x1f && decryptedBuffer[1] === 0x8b) {
      try {
        dbBuffer = zlib.gunzipSync(decryptedBuffer);
      } catch {
        return res.status(400).json({ error: 'Failed to decompress backup file.' });
      }
    } else {
      dbBuffer = decryptedBuffer;
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
}));

module.exports = router;
