const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Setup database directory and file (relative to root)
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'todo.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Schema Migration Check & Re-creation (Tasks Table, includes recurrence column)
const tableInfo = db.prepare('PRAGMA table_info(tasks)').all();
if (tableInfo.length > 0) {
  const tasksTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'").get()?.sql;
  const hasOldConstraint =
    tasksTableSql && (tasksTableSql.includes("'external'") || tasksTableSql.includes('"external"'));
  const hasDueDate = tableInfo.some((col) => col.name === 'due_date');
  const hasExternalAssignee = tableInfo.some((col) => col.name === 'external_assignee');
  const hasAssignedAt = tableInfo.some((col) => col.name === 'assigned_at');
  const hasRecurrence = tableInfo.some((col) => col.name === 'recurrence');

  if (hasOldConstraint || hasDueDate || hasExternalAssignee || !hasAssignedAt || !hasRecurrence) {
    console.log('Database schema updates needed. Running table migration...');

    try {
      db.pragma('foreign_keys = OFF');

      // Create new table with updated check constraints and columns
      db.exec(`
        CREATE TABLE IF NOT EXISTS tasks_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          size TEXT CHECK(size IN ('small', 'medium', 'big')) NOT NULL,
          category_id INTEGER,
          assigned_type TEXT CHECK(assigned_type IN ('unassigned', 'other', 'members')) NOT NULL DEFAULT 'unassigned',
          other_assignee TEXT,
          deadline TEXT,
          completed INTEGER DEFAULT 0 CHECK(completed IN (0, 1)),
          completed_at DATETIME,
          assigned_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          recurrence TEXT CHECK(recurrence IN ('none', 'weekly', 'bi-weekly', 'monthly', 'quarterly')) NOT NULL DEFAULT 'none',
          FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
        );
      `);

      const columns = tableInfo.map((c) => c.name);
      const insertCols = [];
      const selectCols = [];

      const baseMapping = {
        id: 'id',
        title: 'title',
        description: 'description',
        size: 'size',
        category_id: 'category_id',
        completed: 'completed',
        completed_at: 'completed_at',
        created_at: 'created_at'
      };

      for (const [dest, src] of Object.entries(baseMapping)) {
        if (columns.includes(src)) {
          insertCols.push(dest);
          selectCols.push(src);
        }
      }

      // Deadline / Due Date
      if (columns.includes('due_date')) {
        insertCols.push('deadline');
        selectCols.push('due_date');
      } else if (columns.includes('deadline')) {
        insertCols.push('deadline');
        selectCols.push('deadline');
      }

      // Other Assignee / External Assignee
      if (columns.includes('external_assignee')) {
        insertCols.push('other_assignee');
        selectCols.push('external_assignee');
      } else if (columns.includes('other_assignee')) {
        insertCols.push('other_assignee');
        selectCols.push('other_assignee');
      }

      // Assigned Type (migrate external to other)
      if (columns.includes('assigned_type')) {
        insertCols.push('assigned_type');
        selectCols.push("CASE WHEN assigned_type = 'external' THEN 'other' ELSE assigned_type END");
      }

      // Assigned At
      if (columns.includes('assigned_at')) {
        insertCols.push('assigned_at');
        selectCols.push('assigned_at');
      } else {
        insertCols.push('assigned_at');
        selectCols.push('NULL');
      }

      // Recurrence
      if (columns.includes('recurrence')) {
        insertCols.push('recurrence');
        selectCols.push('recurrence');
      } else {
        insertCols.push('recurrence');
        selectCols.push("'none'");
      }

      const insertStmt = `INSERT INTO tasks_new (${insertCols.join(', ')}) SELECT ${selectCols.join(', ')} FROM tasks`;
      db.prepare(insertStmt).run();

      db.exec('DROP TABLE tasks;');
      db.exec('ALTER TABLE tasks_new RENAME TO tasks;');

      console.log('Database table recreation and migrations completed successfully.');
    } catch (err) {
      console.error('Migration error:', err);
    } finally {
      db.pragma('foreign_keys = ON');
    }
  }
}

// Members Schema Migration Check (Avatar field)
const membersTableInfo = db.prepare('PRAGMA table_info(members)').all();
if (membersTableInfo.length > 0) {
  const hasAvatar = membersTableInfo.some((col) => col.name === 'avatar');
  if (!hasAvatar) {
    console.log('Database: Adding avatar column to members table...');
    try {
      db.exec('ALTER TABLE members ADD COLUMN avatar TEXT;');
      console.log('Database: Added avatar column successfully.');
    } catch (err) {
      console.error('Error migrating members schema (avatar):', err);
    }
  }
}

// Memos Schema Migration Check (event_date field)
const memosTableInfo = db.prepare('PRAGMA table_info(memos)').all();
if (memosTableInfo.length > 0) {
  const hasEventDate = memosTableInfo.some((col) => col.name === 'event_date');
  if (!hasEventDate) {
    console.log('Database: Adding event_date column to memos table...');
    try {
      db.exec('ALTER TABLE memos ADD COLUMN event_date TEXT;');
      console.log('Database: Added event_date column successfully.');
    } catch (err) {
      console.error('Error migrating memos schema (event_date):', err);
    }
  }
}

// Shopping Items Multi-list Schema Migration Check
const shoppingTableInfo = db.prepare('PRAGMA table_info(shopping_items)').all();
if (shoppingTableInfo.length > 0) {
  const hasListId = shoppingTableInfo.some((col) => col.name === 'list_id');
  if (!hasListId) {
    console.log('Database: Migrating shopping_items table to support multiple lists...');
    const migrateTx = db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS shopping_lists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const listCount = db.prepare('SELECT count(*) as count FROM shopping_lists').get().count;
      if (listCount === 0) {
        db.prepare("INSERT INTO shopping_lists (id, name) VALUES (1, 'General List')").run();
      }

      db.exec(`
        CREATE TABLE shopping_items_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          quantity TEXT,
          category TEXT NOT NULL DEFAULT 'Other',
          checked INTEGER DEFAULT 0 CHECK(checked IN (0, 1)),
          list_id INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE
        );
      `);

      db.exec(`
        INSERT INTO shopping_items_new (id, name, quantity, category, checked, created_at, list_id)
        SELECT id, name, quantity, category, checked, created_at, 1 FROM shopping_items;
      `);

      db.exec('DROP TABLE shopping_items;');
      db.exec('ALTER TABLE shopping_items_new RENAME TO shopping_items;');
      db.exec('CREATE INDEX IF NOT EXISTS idx_shopping_items_checked ON shopping_items(checked);');
      db.exec('CREATE INDEX IF NOT EXISTS idx_shopping_items_list_id ON shopping_items(list_id);');
    });

    try {
      migrateTx();
      console.log('Database: Shopping items migrated successfully.');
    } catch (err) {
      console.error('Error migrating shopping items schema:', err);
    }
  }
}

// Weather Locations Schema Check & Migration
const weatherLocTableCount = db
  .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='weather_locations'")
  .get().count;
if (weatherLocTableCount === 0) {
  console.log('Database: Creating weather_locations table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS weather_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      is_home INTEGER DEFAULT 0 CHECK(is_home IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrate existing weather_city setting
  try {
    const existingCity = db.prepare("SELECT value FROM settings WHERE key = 'weather_city'").get()?.value;
    if (existingCity && existingCity.trim()) {
      db.prepare('INSERT OR IGNORE INTO weather_locations (name, is_home) VALUES (?, 1)').run(existingCity.trim());
      console.log(`Database: Migrated weather city "${existingCity}" to weather_locations as home.`);
    }
  } catch (err) {
    console.error('Database: Failed to migrate existing weather city:', err.message);
  }
} else {
  // If table exists, make sure it has 'is_home' column
  const cols = db.prepare('PRAGMA table_info(weather_locations)').all();
  const hasIsHome = cols.some((col) => col.name === 'is_home');
  if (!hasIsHome) {
    console.log('Database: Adding is_home column to weather_locations table...');
    try {
      db.exec('ALTER TABLE weather_locations ADD COLUMN is_home INTEGER DEFAULT 0;');
      // Mark the first location as default home location so it's populated
      db.exec(
        'UPDATE weather_locations SET is_home = 1 WHERE id = (SELECT id FROM weather_locations ORDER BY id ASC LIMIT 1);'
      );
      console.log('Database: Added is_home column successfully.');
    } catch (err) {
      console.error('Error migrating weather_locations schema (is_home):', err);
    }
  }
}

// Initialise Database Schema (with Memos & Shopping Items support)
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL,
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    size TEXT CHECK(size IN ('small', 'medium', 'big')) NOT NULL,
    category_id INTEGER,
    assigned_type TEXT CHECK(assigned_type IN ('unassigned', 'other', 'members')) NOT NULL DEFAULT 'unassigned',
    other_assignee TEXT,
    deadline TEXT,
    completed INTEGER DEFAULT 0 CHECK(completed IN (0, 1)),
    completed_at DATETIME,
    assigned_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    recurrence TEXT CHECK(recurrence IN ('none', 'weekly', 'bi-weekly', 'monthly', 'quarterly')) NOT NULL DEFAULT 'none',
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS task_members (
    task_id INTEGER,
    member_id INTEGER,
    PRIMARY KEY(task_id, member_id),
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS memos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#fef08a',
    event_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shopping_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shopping_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS shopping_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    quantity TEXT,
    category TEXT NOT NULL DEFAULT 'Other',
    checked INTEGER DEFAULT 0 CHECK(checked IN (0, 1)),
    list_id INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS weather_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    is_home INTEGER DEFAULT 0 CHECK(is_home IN (0, 1)),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
  CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
  CREATE INDEX IF NOT EXISTS idx_task_members_member_id ON task_members(member_id);
  CREATE INDEX IF NOT EXISTS idx_shopping_items_checked ON shopping_items(checked);
  CREATE INDEX IF NOT EXISTS idx_shopping_items_list_id ON shopping_items(list_id);
`);

// Populate default data if tables are empty
const categoryCount = db.prepare('SELECT count(*) as count FROM categories').get().count;
if (categoryCount === 0) {
  const insertCategory = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)');
  const defaultCategories = [
    ['Cleaning', '#ef4444'], // red
    ['Maintenance', '#3b82f6'], // blue
    ['Gardening', '#10b981'], // green
    ['Groceries', '#f59e0b'], // orange
    ['Cooking', '#8b5cf6'], // purple
    ['Other', '#6b7280'] // gray
  ];
  const transaction = db.transaction((categories) => {
    for (const [name, color] of categories) {
      insertCategory.run(name, color);
    }
  });
  transaction(defaultCategories);
}

const memberCount = db.prepare('SELECT count(*) as count FROM members').get().count;
if (memberCount === 0) {
  const insertMember = db.prepare('INSERT INTO members (name, color) VALUES (?, ?)');
  const defaultMembers = [
    ['Mom', '#ec4899'], // pink
    ['Dad', '#06b6d4'], // cyan
    ['Kids', '#10b981'] // green
  ];
  const transaction = db.transaction((members) => {
    for (const [name, color] of members) {
      insertMember.run(name, color);
    }
  });
  transaction(defaultMembers);
}

// Populate default shopping categories if table is empty
const shoppingCategoryCount = db.prepare('SELECT count(*) as count FROM shopping_categories').get().count;
if (shoppingCategoryCount === 0) {
  const insertShoppingCat = db.prepare('INSERT INTO shopping_categories (name) VALUES (?)');
  const defaultShoppingCategories = ['Produce', 'Dairy', 'Bakery', 'Meat', 'Pantry', 'Household', 'Other'];
  const transaction = db.transaction((categories) => {
    for (const name of categories) {
      insertShoppingCat.run(name);
    }
  });
  transaction(defaultShoppingCategories);
}

// Populate default shopping lists if table is empty
const listCount = db.prepare('SELECT count(*) as count FROM shopping_lists').get().count;
if (listCount === 0) {
  db.prepare("INSERT INTO shopping_lists (id, name) VALUES (1, 'General List')").run();
}

const settingsCount = db.prepare('SELECT count(*) as count FROM settings').get().count;
if (settingsCount === 0) {
  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('app_title', 'HomeBoard');
  insertSetting.run('tasks_per_page', '10');
  insertSetting.run('weather_city', '');
  insertSetting.run('weather_apikey', '');
  insertSetting.run('password_protection_enabled', '0');
  insertSetting.run('app_password', '');
} else {
  // Ensure all keys exist for existing tables
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('app_title', 'HomeBoard');
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('tasks_per_page', '10');
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('weather_city', '');
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('weather_apikey', '');
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('password_protection_enabled', '0');
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('app_password', '');
}

module.exports = db;
