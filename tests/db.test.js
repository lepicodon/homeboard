const db = require('../src/config/db');

describe('Database Tests', () => {
  test('Database should be initialized with default categories', () => {
    const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.some((c) => c.name === 'Cleaning')).toBe(true);
  });

  test('Database should be initialized with default members', () => {
    const members = db.prepare('SELECT * FROM members').all();
    expect(members.length).toBeGreaterThan(0);
    expect(members.some((m) => m.name === 'Mom')).toBe(true);
  });

  test('Database should support CRUD on tasks', () => {
    const stmt = db.prepare(`
      INSERT INTO tasks (title, description, size, recurrence)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run('Test Jest Task', 'Testing with Jest', 'small', 'none');
    expect(info.changes).toBe(1);
    const taskId = info.lastInsertRowid;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    expect(task.title).toBe('Test Jest Task');

    const deleteInfo = db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
    expect(deleteInfo.changes).toBe(1);
  });

  test('Database should support CRUD on weather locations', () => {
    const stmt = db.prepare('INSERT INTO weather_locations (name) VALUES (?)');
    const info = stmt.run('Paris, FR');
    expect(info.changes).toBe(1);
    const locId = info.lastInsertRowid;

    const loc = db.prepare('SELECT * FROM weather_locations WHERE id = ?').get(locId);
    expect(loc.name).toBe('Paris, FR');

    expect(() => {
      stmt.run('Paris, FR');
    }).toThrow();

    const deleteInfo = db.prepare('DELETE FROM weather_locations WHERE id = ?').run(locId);
    expect(deleteInfo.changes).toBe(1);
  });

  test('Database should support setting weather location as home', () => {
    const stmt = db.prepare('INSERT INTO weather_locations (name) VALUES (?)');
    const locId1 = stmt.run('London, UK').lastInsertRowid;
    const locId2 = stmt.run('Tokyo, JP').lastInsertRowid;

    expect(db.prepare('SELECT is_home FROM weather_locations WHERE id = ?').get(locId1).is_home).toBe(0);
    expect(db.prepare('SELECT is_home FROM weather_locations WHERE id = ?').get(locId2).is_home).toBe(0);

    const updateTx = db.transaction((id) => {
      db.prepare('UPDATE weather_locations SET is_home = 0').run();
      db.prepare('UPDATE weather_locations SET is_home = 1 WHERE id = ?').run(id);
    });
    updateTx(locId1);

    expect(db.prepare('SELECT is_home FROM weather_locations WHERE id = ?').get(locId1).is_home).toBe(1);
    expect(db.prepare('SELECT is_home FROM weather_locations WHERE id = ?').get(locId2).is_home).toBe(0);

    updateTx(locId2);

    expect(db.prepare('SELECT is_home FROM weather_locations WHERE id = ?').get(locId1).is_home).toBe(0);
    expect(db.prepare('SELECT is_home FROM weather_locations WHERE id = ?').get(locId2).is_home).toBe(1);

    db.prepare('DELETE FROM weather_locations WHERE id IN (?, ?)').run(locId1, locId2);
  });
});
