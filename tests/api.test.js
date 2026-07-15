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
});
