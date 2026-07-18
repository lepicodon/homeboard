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

    test('POST /api/settings/backup with compress=false should return raw database file', async () => {
      const res = await request(app).post('/api/settings/backup').send({ password: '', compress: false });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/octet-stream');
      expect(res.headers['content-disposition']).not.toContain('.gz');
      expect(res.body.subarray(0, 16).toString()).toBe('SQLite format 3\0');
    });

    test('POST /api/settings/restore should restore successfully from uncompressed backup', async () => {
      db.prepare("INSERT OR IGNORE INTO categories (name, color) VALUES ('BackupTestRaw', '#ffffff')").run();
      const resBackup = await request(app).post('/api/settings/backup').send({ password: '', compress: false });
      expect(resBackup.status).toBe(200);
      const rawBase64 = resBackup.body.toString('base64');

      db.prepare("DELETE FROM categories WHERE name = 'BackupTestRaw'").run();
      let cat = db.prepare("SELECT * FROM categories WHERE name = 'BackupTestRaw'").get();
      expect(cat).toBeUndefined();

      const resRestore = await request(app).post('/api/settings/restore').send({ file: rawBase64 });
      expect(resRestore.status).toBe(200);
      expect(resRestore.body.success).toBe(true);

      cat = db.prepare("SELECT * FROM categories WHERE name = 'BackupTestRaw'").get();
      expect(cat).toBeDefined();
      expect(cat.name).toBe('BackupTestRaw');

      db.prepare("DELETE FROM categories WHERE name = 'BackupTestRaw'").run();
    });
  });

  describe('Phase 1 Custom Fixes Tests', () => {
    beforeAll(() => {
      db.prepare("UPDATE settings SET value = '0' WHERE key = 'password_protection_enabled'").run();
      db.prepare("UPDATE settings SET value = '' WHERE key = 'app_password'").run();
    });

    describe('POST /api/weather/locations input validation', () => {
      test('should reject empty or missing names', async () => {
        const res = await request(app).post('/api/weather/locations').send({ name: '' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('City name is required.');

        const resMissing = await request(app).post('/api/weather/locations').send({});
        expect(resMissing.status).toBe(400);
      });

      test('should reject non-string names', async () => {
        const res = await request(app).post('/api/weather/locations').send({ name: 12345 });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('City name is required.');
      });

      test('should reject names longer than 100 characters', async () => {
        const longName = 'a'.repeat(101);
        const res = await request(app).post('/api/weather/locations').send({ name: longName });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('City name cannot exceed 100 characters.');
      });

      test('should trim name before inserting and succeed', async () => {
        const cityName = '   TestCityTrimming   ';
        const res = await request(app).post('/api/weather/locations').send({ name: cityName });
        expect(res.status).toBe(201);
        expect(res.body.name).toBe('TestCityTrimming');

        // Cleanup
        db.prepare("DELETE FROM weather_locations WHERE name = 'TestCityTrimming'").run();
      });
    });

    describe('GET/POST/DELETE /api/settings/background endpoints', () => {
      const DUMMY_BASE64_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='; // 1x1 png

      test('should save base64 background image, retrieve it, and delete it successfully', async () => {
        // 1. POST (Save)
        const resSave = await request(app)
          .post('/api/settings/background')
          .send({ image: `data:image/png;base64,${DUMMY_BASE64_IMAGE}` });
        expect(resSave.status).toBe(200);
        expect(resSave.body.success).toBe(true);

        // 2. GET (Retrieve)
        const resGet = await request(app).get('/api/settings/background');
        expect(resGet.status).toBe(200);
        expect(resGet.headers['cache-control']).toBe('public, max-age=86400');

        // 3. DELETE (Clear)
        const resDelete = await request(app).delete('/api/settings/background');
        expect(resDelete.status).toBe(200);
        expect(resDelete.body.success).toBe(true);

        // 4. GET after delete (should return 404)
        const resGetAfter = await request(app).get('/api/settings/background');
        expect(resGetAfter.status).toBe(404);
      });
    });
  });

  describe('Phase 2 Custom Fixes Tests', () => {
    const TEST_PASSWORD = 'phase2-test-password';

    beforeAll(() => {
      // Enable password protection
      db.prepare("UPDATE settings SET value = '1' WHERE key = 'password_protection_enabled'").run();
      db.prepare("UPDATE settings SET value = ? WHERE key = 'app_password'").run(TEST_PASSWORD);
    });

    afterAll(() => {
      // Disable password protection
      db.prepare("UPDATE settings SET value = '0' WHERE key = 'password_protection_enabled'").run();
      db.prepare("UPDATE settings SET value = '' WHERE key = 'app_password'").run();
    });

    test('should reject query parameter auth (?pw=...) and accept header auth', async () => {
      // Try query parameter auth (should fail)
      const resQuery = await request(app).get(`/api/tasks?pw=${TEST_PASSWORD}`);
      expect(resQuery.status).toBe(401);
      expect(resQuery.body.error).toBe('Authentication required');

      // Try header auth (should succeed)
      const resHeader = await request(app).get('/api/tasks').set('x-app-password', TEST_PASSWORD);
      expect(resHeader.status).toBe(200);
      expect(Array.isArray(resHeader.body)).toBe(true);
    });

    test('should restore legacy encrypted backup (N=16384) successfully', async () => {
      // 1. Disable auth temporarily for backup generation
      db.prepare("UPDATE settings SET value = '0' WHERE key = 'password_protection_enabled'").run();
      db.prepare("UPDATE settings SET value = '' WHERE key = 'app_password'").run();

      db.prepare("INSERT OR IGNORE INTO categories (name, color) VALUES ('Phase2LegacyTest', '#000000')").run();

      // Get valid unencrypted backup (gzipped)
      const resBackup = await request(app).post('/api/settings/backup').send({ password: '' });
      expect(resBackup.status).toBe(200);
      const gzipBuffer = resBackup.body;

      // 2. Encrypt it manually in the test using legacy N=16384 parameters
      const crypto = require('crypto');
      const backupPassword = 'legacy-backup-pw';
      const salt = crypto.randomBytes(16);
      const key = crypto.scryptSync(backupPassword, salt, 32, { N: 16384, r: 8, p: 1 });
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([cipher.update(gzipBuffer), cipher.final()]);
      const authTag = cipher.getAuthTag();

      const header = Buffer.from('HBENC');
      const legacyBackupBuffer = Buffer.concat([header, salt, iv, authTag, ciphertext]);
      const base64Backup = legacyBackupBuffer.toString('base64');

      // Delete category so we can verify recovery
      db.prepare("DELETE FROM categories WHERE name = 'Phase2LegacyTest'").run();

      // 3. Restore it
      const resRestore = await request(app)
        .post('/api/settings/restore')
        .send({ file: base64Backup, password: backupPassword });
      expect(resRestore.status).toBe(200);
      expect(resRestore.body.success).toBe(true);

      // Verify category is restored
      const cat = db.prepare("SELECT * FROM categories WHERE name = 'Phase2LegacyTest'").get();
      expect(cat).toBeDefined();
      expect(cat.name).toBe('Phase2LegacyTest');

      // Cleanup
      db.prepare("DELETE FROM categories WHERE name = 'Phase2LegacyTest'").run();
    });

    test('should restore new encrypted backup (N=131072) successfully', async () => {
      // 1. Generate encrypted backup (uses the new work factor 131072)
      const backupPassword = 'new-backup-pw';
      const resBackup = await request(app).post('/api/settings/backup').send({ password: backupPassword });
      expect(resBackup.status).toBe(200);
      const base64Backup = resBackup.body.toString('base64');

      // 2. Restore it
      const resRestore = await request(app)
        .post('/api/settings/restore')
        .send({ file: base64Backup, password: backupPassword });
      expect(resRestore.status).toBe(200);
      expect(resRestore.body.success).toBe(true);
    });
  });

  describe('Phase 3 Custom Fixes Tests', () => {
    beforeAll(() => {
      // Disable password protection initially
      db.prepare("UPDATE settings SET value = '0' WHERE key = 'password_protection_enabled'").run();
      db.prepare("UPDATE settings SET value = '' WHERE key = 'app_password'").run();
    });

    describe('Password Hashing & Auto-Migration', () => {
      test('should hash password when saved via settings PUT', async () => {
        // 1. Save a new password via PUT settings
        const settingsPayload = {
          app_title: 'HomeBoard Hashing Test',
          tasks_per_page: '10',
          weather_apikey: '',
          password_protection_enabled: true,
          app_password: 'new-hashed-password',
          background_type: 'none',
          background_url: ''
        };

        const resPut = await request(app).put('/api/settings').send(settingsPayload);
        expect(resPut.status).toBe(200);

        // 2. Verify that it was saved in a hashed format in the database
        const storedPassword = db.prepare("SELECT value FROM settings WHERE key = 'app_password'").get()?.value || '';
        expect(storedPassword.startsWith('$pbkdf2$')).toBe(true);

        // 3. Verify that we can authenticate using the password
        const resAuth = await request(app).post('/api/settings/authenticate').send({ password: 'new-hashed-password' });
        expect(resAuth.status).toBe(200);
        expect(resAuth.body.success).toBe(true);
      });

      test('should perform dynamic plain-text login migration to hashed password', async () => {
        const plainTextPassword = 'legacy-plain-password-123';
        
        // 1. Manually write a plain-text password to settings
        db.prepare("UPDATE settings SET value = '1' WHERE key = 'password_protection_enabled'").run();
        db.prepare("UPDATE settings SET value = ? WHERE key = 'app_password'").run(plainTextPassword);

        // 2. Perform authenticate request
        const resAuth = await request(app).post('/api/settings/authenticate').send({ password: plainTextPassword });
        expect(resAuth.status).toBe(200);
        expect(resAuth.body.success).toBe(true);

        // 3. Verify that the DB setting has been automatically migrated to hashed format
        const storedPassword = db.prepare("SELECT value FROM settings WHERE key = 'app_password'").get()?.value || '';
        expect(storedPassword.startsWith('$pbkdf2$')).toBe(true);

        // 4. Verify we can still log in using the same password
        const resAuthAfter = await request(app).post('/api/settings/authenticate').send({ password: plainTextPassword });
        expect(resAuthAfter.status).toBe(200);
      });
    });

    describe('Server-Side Task Pagination', () => {
      test('should paginate tasks and return X-Total-Count header', async () => {
        // 1. Disable auth for simple task updates
        db.prepare("UPDATE settings SET value = '0' WHERE key = 'password_protection_enabled'").run();
        db.prepare("UPDATE settings SET value = '' WHERE key = 'app_password'").run();

        // 2. Create 3 dummy tasks
        const task1 = await request(app).post('/api/tasks').send({ title: 'Pagination Task 1', size: 'small', assigned_type: 'unassigned' });
        const task2 = await request(app).post('/api/tasks').send({ title: 'Pagination Task 2', size: 'medium', assigned_type: 'unassigned' });
        const task3 = await request(app).post('/api/tasks').send({ title: 'Pagination Task 3', size: 'big', assigned_type: 'unassigned' });

        expect(task1.status).toBe(201);
        expect(task2.status).toBe(201);
        expect(task3.status).toBe(201);

        // 3. Query paginated page=1 limit=2
        const resPaginated = await request(app).get('/api/tasks?page=1&limit=2');
        expect(resPaginated.status).toBe(200);
        expect(Array.isArray(resPaginated.body)).toBe(true);
        expect(resPaginated.body.length).toBe(2);
        expect(resPaginated.headers['x-total-count']).toBeDefined();
        
        const totalCount = parseInt(resPaginated.headers['x-total-count'], 10);
        expect(totalCount).toBeGreaterThanOrEqual(3);

        // 4. Cleanup
        db.prepare("DELETE FROM tasks WHERE title LIKE 'Pagination Task %'").run();
      });
    });

    describe('Categories & Members CRUD Operations', () => {
      test('should support category CRUD lifecycle', async () => {
        // Create
        const resCreate = await request(app).post('/api/categories').send({ name: 'CRUDTestCategory', color: '#ff00ff' });
        expect(resCreate.status).toBe(201);
        const categoryId = resCreate.body.id;

        // List
        const resList = await request(app).get('/api/categories');
        const found = resList.body.find(c => c.id === categoryId);
        expect(found).toBeDefined();
        expect(found.name).toBe('CRUDTestCategory');

        // Update
        const resUpdate = await request(app).put(`/api/categories/${categoryId}`).send({ name: 'CRUDTestCategoryUpdated', color: '#00ffff' });
        expect(resUpdate.status).toBe(200);
        expect(resUpdate.body.name).toBe('CRUDTestCategoryUpdated');

        // Delete
        const resDelete = await request(app).delete(`/api/categories/${categoryId}`);
        expect(resDelete.status).toBe(200);
      });

      test('should support member CRUD lifecycle', async () => {
        // Create
        const resCreate = await request(app).post('/api/members').send({ name: 'CRUDTestMember', color: '#ff00ff', avatar: 'avatar.png' });
        expect(resCreate.status).toBe(201);
        const memberId = resCreate.body.id;

        // List
        const resList = await request(app).get('/api/members');
        const found = resList.body.find(m => m.id === memberId);
        expect(found).toBeDefined();
        expect(found.name).toBe('CRUDTestMember');

        // Update
        const resUpdate = await request(app).put(`/api/members/${memberId}`).send({ name: 'CRUDTestMemberUpdated', color: '#00ffff', avatar: 'avatar2.png' });
        expect(resUpdate.status).toBe(200);
        expect(resUpdate.body.name).toBe('CRUDTestMemberUpdated');

        // Delete
        const resDelete = await request(app).delete(`/api/members/${memberId}`);
        expect(resDelete.status).toBe(200);
      });
    });

    describe('Centralized Error Handler', () => {
      test('should return 400 with descriptive error on database constraints', async () => {
        // Create duplicate category (should trigger UNIQUE constraint error)
        db.prepare("INSERT OR IGNORE INTO categories (name, color) VALUES ('DuplicateCat', '#000000')").run();
        
        const resDuplicate = await request(app).post('/api/categories').send({ name: 'DuplicateCat', color: '#ffffff' });
        expect(resDuplicate.status).toBe(400);
        expect(resDuplicate.body.error).toContain('Category name already exists.');

        // Cleanup
        db.prepare("DELETE FROM categories WHERE name = 'DuplicateCat'").run();
      });
    });

    describe('Shopping & Memos CRUD Operations', () => {
      test('should support memo CRUD lifecycle', async () => {
        // Create
        const resCreate = await request(app)
          .post('/api/memos')
          .send({ content: 'CRUD Test Memo Content', color: '#ff00ff', event_date: '2026-07-20' });
        expect(resCreate.status).toBe(201);
        const memoId = resCreate.body.id;

        // List
        const resList = await request(app).get('/api/memos');
        const found = resList.body.find(m => m.id === memoId);
        expect(found).toBeDefined();
        expect(found.content).toBe('CRUD Test Memo Content');

        // Update
        const resUpdate = await request(app)
          .put(`/api/memos/${memoId}`)
          .send({ content: 'CRUD Test Memo Content Updated', color: '#00ffff' });
        expect(resUpdate.status).toBe(200);
        expect(resUpdate.body.content).toBe('CRUD Test Memo Content Updated');

        // Delete
        const resDelete = await request(app).delete(`/api/memos/${memoId}`);
        expect(resDelete.status).toBe(200);
      });

      test('should support shopping list and items CRUD lifecycle', async () => {
        // Create List
        const resListCreate = await request(app)
          .post('/api/shopping/lists')
          .send({ name: 'CRUD Test Shopping List' });
        expect(resListCreate.status).toBe(201);
        const listId = resListCreate.body.id;

        // List lists
        const resLists = await request(app).get('/api/shopping/lists');
        const foundList = resLists.body.find(l => l.id === listId);
        expect(foundList).toBeDefined();
        expect(foundList.name).toBe('CRUD Test Shopping List');

        // Create Item in List
        const resItemCreate = await request(app)
          .post('/api/shopping')
          .send({ name: 'Apples', quantity: '3 bags', category: 'Fruit', list_id: listId });
        expect(resItemCreate.status).toBe(201);
        const itemId = resItemCreate.body.id;

        // List Items
        const resItems = await request(app).get(`/api/shopping?list_id=${listId}`);
        const foundItem = resItems.body.find(i => i.id === itemId);
        expect(foundItem).toBeDefined();
        expect(foundItem.name).toBe('Apples');

        // Toggle Item checked status
        const resToggle = await request(app).patch(`/api/shopping/${itemId}/toggle`);
        expect(resToggle.status).toBe(200);
        expect(resToggle.body.checked).toBe(true);

        // Clear completed items
        const resClear = await request(app).post(`/api/shopping/clear-completed?list_id=${listId}`);
        expect(resClear.status).toBe(200);

        // Verify item is deleted because it was cleared
        const resItemsAfter = await request(app).get(`/api/shopping?list_id=${listId}`);
        const foundItemAfter = resItemsAfter.body.find(i => i.id === itemId);
        expect(foundItemAfter).toBeUndefined();

        // Delete List
        const resListDelete = await request(app).delete(`/api/shopping/lists/${listId}`);
        expect(resListDelete.status).toBe(200);
      });
    });
  });
});
