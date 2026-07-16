/* global beforeAll, afterAll, describe, test, expect */
const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');

describe('API Integration Tests', () => {
  let originalSettings = {};

  beforeAll(() => {
    // Backup original settings to restore them after tests
    try {
      const rows = db.prepare('SELECT * FROM settings').all();
      rows.forEach((r) => {
        originalSettings[r.key] = r.value;
      });
    } catch (err) {
      console.error('Failed to backup settings', err);
    }
  });

  afterAll(() => {
    // Restore original settings
    try {
      const updateTx = db.transaction(() => {
        db.prepare('DELETE FROM settings').run();
        const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
        Object.entries(originalSettings).forEach(([key, value]) => {
          insertSetting.run(key, value);
        });
      });
      updateTx();
    } catch (err) {
      console.error('Failed to restore settings', err);
    }
  });

  describe('Unauthenticated API Operations', () => {
    beforeEach(() => {
      // Ensure password protection is disabled
      db.prepare("UPDATE settings SET value = '0' WHERE key = 'password_protection_enabled'").run();
      db.prepare("UPDATE settings SET value = '' WHERE key = 'app_password'").run();
    });

    test('GET /api/settings/auth-status should report disabled', async () => {
      const res = await request(app).get('/api/settings/auth-status');
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
      expect(res.body.authenticated).toBe(true);
    });

    test('GET /api/categories should return status 200 and an array', async () => {
      const res = await request(app).get('/api/categories');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/members should return status 200 and an array', async () => {
      const res = await request(app).get('/api/members');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('GET /api/tasks should return status 200 and an array', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('POST /api/settings/authenticate with empty password should succeed (since DB has no password)', async () => {
      const res = await request(app).post('/api/settings/authenticate').send({ password: '' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('POST /api/settings/background/fetch-external should reject private or loopback URLs (SSRF protection)', async () => {
      const res1 = await request(app)
        .post('/api/settings/background/fetch-external')
        .send({ url: 'http://localhost/image.png' });
      expect(res1.status).toBe(400);
      expect(res1.body.error).toContain('Restricted URL');

      const res2 = await request(app)
        .post('/api/settings/background/fetch-external')
        .send({ url: 'http://127.0.0.1:3000/public/css/style.css' });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toContain('Restricted URL');
    });
  });

  describe('Password-Protected API Operations', () => {
    const TEST_PASSWORD = 'jest-test-password';

    beforeEach(() => {
      // Enable password protection in the database settings
      db.prepare("UPDATE settings SET value = '1' WHERE key = 'password_protection_enabled'").run();
      db.prepare("UPDATE settings SET value = ? WHERE key = 'app_password'").run(TEST_PASSWORD);
    });

    test('GET /api/settings/auth-status should report enabled but unauthenticated without header', async () => {
      const res = await request(app).get('/api/settings/auth-status');
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
      expect(res.body.authenticated).toBe(false);
    });

    test('GET /api/settings/auth-status should report authenticated with correct header', async () => {
      const res = await request(app).get('/api/settings/auth-status').set('x-app-password', TEST_PASSWORD);
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
      expect(res.body.authenticated).toBe(true);
    });

    test('GET /api/tasks should be blocked and return 401 without header', async () => {
      const res = await request(app).get('/api/tasks');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    test('GET /api/tasks should be blocked and return 401 with incorrect header', async () => {
      const res = await request(app).get('/api/tasks').set('x-app-password', 'wrong-pass');
      expect(res.status).toBe(401);
    });

    test('GET /api/tasks should pass and return 200 with correct header', async () => {
      const res = await request(app).get('/api/tasks').set('x-app-password', TEST_PASSWORD);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('POST /api/settings/authenticate should validate correct password', async () => {
      const res = await request(app).post('/api/settings/authenticate').send({ password: TEST_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('POST /api/settings/authenticate should reject incorrect password', async () => {
      const res = await request(app).post('/api/settings/authenticate').send({ password: 'wrong-password' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Incorrect password');
    });
  });

  describe('Backup & Restore API Operations', () => {
    let unencryptedBackupBase64 = '';
    let encryptedBackupBase64 = '';
    const BACKUP_PASS = 'backup-secure-pass';

    beforeAll(async () => {
      // Disable password protection for backup tests
      db.prepare("UPDATE settings SET value = '0' WHERE key = 'password_protection_enabled'").run();
      db.prepare("UPDATE settings SET value = '' WHERE key = 'app_password'").run();

      // Insert a dummy category to backup
      db.prepare("INSERT OR IGNORE INTO categories (name, color) VALUES ('BackupTestUnique', '#ffffff')").run();

      // Make an unencrypted backup
      const resUnencrypted = await request(app).post('/api/settings/backup').send({ password: '' });
      expect(resUnencrypted.status).toBe(200);
      unencryptedBackupBase64 = resUnencrypted.body.toString('base64');

      // Make an encrypted backup
      const resEncrypted = await request(app).post('/api/settings/backup').send({ password: BACKUP_PASS });
      expect(resEncrypted.status).toBe(200);
      encryptedBackupBase64 = resEncrypted.body.toString('base64');

      // Remove the category to test restore later
      db.prepare("DELETE FROM categories WHERE name = 'BackupTestUnique'").run();
    });

    test('POST /api/settings/backup should return compressed binary for unencrypted backup', async () => {
      const res = await request(app).post('/api/settings/backup').send({ password: '' });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/octet-stream');
      expect(res.headers['content-disposition']).toContain('attachment;');
      expect(res.body[0]).toBe(0x1f);
      expect(res.body[1]).toBe(0x8b); // Gzip magic header
    });

    test('POST /api/settings/backup should return encrypted binary with HBENC magic string for encrypted backup', async () => {
      const res = await request(app).post('/api/settings/backup').send({ password: 'some-pass' });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/octet-stream');
      expect(res.headers['content-disposition']).toContain('.enc');

      const header = res.body.subarray(0, 5).toString();
      expect(header).toBe('HBENC');
    });

    test('POST /api/settings/restore should fail if no file is provided', async () => {
      const res = await request(app).post('/api/settings/restore').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('file data is required');
    });

    test('POST /api/settings/restore should fail with PASSWORD_REQUIRED when restoring encrypted backup without password', async () => {
      const res = await request(app).post('/api/settings/restore').send({ file: encryptedBackupBase64 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('PASSWORD_REQUIRED');
    });

    test('POST /api/settings/restore should fail with INCORRECT_PASSWORD when restoring encrypted backup with wrong password', async () => {
      const res = await request(app)
        .post('/api/settings/restore')
        .send({ file: encryptedBackupBase64, password: 'wrong-password' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INCORRECT_PASSWORD');
    });

    test('POST /api/settings/restore should restore successfully from unencrypted backup and recover deleted category', async () => {
      // Pre-verification: Category should not exist right now
      let cat = db.prepare("SELECT * FROM categories WHERE name = 'BackupTestUnique'").get();
      expect(cat).toBeUndefined();

      const res = await request(app).post('/api/settings/restore').send({ file: unencryptedBackupBase64 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Post-verification: Category should exist now
      cat = db.prepare("SELECT * FROM categories WHERE name = 'BackupTestUnique'").get();
      expect(cat).toBeDefined();
      expect(cat.name).toBe('BackupTestUnique');
    });

    test('POST /api/settings/restore should restore successfully from encrypted backup with correct password', async () => {
      // Delete the category again
      db.prepare("DELETE FROM categories WHERE name = 'BackupTestUnique'").run();

      let cat = db.prepare("SELECT * FROM categories WHERE name = 'BackupTestUnique'").get();
      expect(cat).toBeUndefined();

      const res = await request(app)
        .post('/api/settings/restore')
        .send({ file: encryptedBackupBase64, password: BACKUP_PASS });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Post-verification
      cat = db.prepare("SELECT * FROM categories WHERE name = 'BackupTestUnique'").get();
      expect(cat).toBeDefined();
      expect(cat.name).toBe('BackupTestUnique');

      // Cleanup
      db.prepare("DELETE FROM categories WHERE name = 'BackupTestUnique'").run();
    });
  });
});
