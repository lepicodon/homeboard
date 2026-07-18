const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'homeboard.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Remove existing DB file to start fresh
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Deleted existing database file to seed a fresh one.');
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Initialize schema
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

console.log('Database schema created successfully.');

// 1. Seed categories
const defaultCategories = [
  ['Cleaning', '#ef4444'], // Red
  ['Maintenance', '#3b82f6'], // Blue
  ['Gardening', '#10b981'], // Green
  ['Groceries', '#f59e0b'], // Orange
  ['Cooking', '#8b5cf6'], // Purple
  ['Other', '#6b7280'] // Gray
];
const insertCategory = db.prepare('INSERT INTO categories (id, name, color) VALUES (?, ?, ?)');
defaultCategories.forEach((cat, idx) => {
  insertCategory.run(idx + 1, cat[0], cat[1]);
});

// 2. Seed members
const defaultMembers = [
  ['Mom', '#ec4899', null], // Pink
  ['Dad', '#06b6d4', null], // Cyan
  ['Kids', '#10b981', null], // Green
  ['Emily', '#8b5cf6', null] // Purple
];
const insertMember = db.prepare('INSERT INTO members (id, name, color, avatar) VALUES (?, ?, ?, ?)');
defaultMembers.forEach((member, idx) => {
  insertMember.run(idx + 1, member[0], member[1], member[2]);
});

// 3. Seed shopping categories
const defaultShoppingCategories = ['Produce', 'Dairy', 'Bakery', 'Meat', 'Pantry', 'Household', 'Other'];
const insertShoppingCat = db.prepare('INSERT INTO shopping_categories (id, name) VALUES (?, ?)');
defaultShoppingCategories.forEach((cat, idx) => {
  insertShoppingCat.run(idx + 1, cat);
});

// 4. Seed shopping lists
const defaultShoppingLists = [
  [1, 'General List'],
  [2, 'Costco Wholesale'],
  [3, 'Home Depot']
];
const insertShoppingList = db.prepare('INSERT INTO shopping_lists (id, name) VALUES (?, ?)');
defaultShoppingLists.forEach((list) => {
  insertShoppingList.run(list[0], list[1]);
});

// 5. Seed settings
const defaultSettings = [
  ['app_title', 'Sweet Home Dashboard'],
  ['tasks_per_page', '10'],
  ['weather_city', 'Vancouver, BC'],
  ['weather_apikey', ''],
  ['password_protection_enabled', '0'],
  ['app_password', ''],
  ['background_type', 'none'],
  ['background_url', '']
];
const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
defaultSettings.forEach((setting) => {
  insertSetting.run(setting[0], setting[1]);
});

// 6. Seed weather locations
const defaultWeatherLocs = [
  ['Vancouver, BC', 1],
  ['Paris, France', 0],
  ['Tokyo, Japan', 0],
  ['New York, US', 0]
];
const insertWeatherLoc = db.prepare('INSERT INTO weather_locations (name, is_home) VALUES (?, ?)');
defaultWeatherLocs.forEach((loc) => {
  insertWeatherLoc.run(loc[0], loc[1]);
});

// 7. Seed Tasks & Task Members
// We relative-date them using current year/month/day
const today = new Date();
const formatDate = (daysOffset) => {
  const d = new Date(today);
  d.setDate(today.getDate() + daysOffset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateTime = (daysOffset) => {
  const d = new Date(today);
  d.setDate(today.getDate() + daysOffset);
  return d.toISOString();
};

const tasksToInsert = [
  // id, title, description, size, category_id, assigned_type, other_assignee, deadline, completed, completed_at, assigned_at, recurrence
  [
    1,
    'Clean the BBQ grill',
    'Deep clean the grates, grease tray, and external stainless steel surfaces ahead of the weekend.',
    'big',
    5, // Cooking
    'members',
    null,
    formatDate(-2),
    1,
    formatDateTime(-2),
    formatDateTime(-2),
    'none'
  ],
  [
    2,
    'Reset router & update Wi-Fi passwords',
    'Perform standard monthly router reboot and update the WPA3 master key.',
    'small',
    2, // Maintenance
    'members',
    null,
    formatDate(-2),
    1,
    formatDateTime(-2),
    formatDateTime(-2),
    'monthly'
  ],
  [
    3,
    'Mow the front & backyard lawns',
    'Trim borders, clear clippings, and water the garden afterwards.',
    'medium',
    3, // Gardening
    'members',
    null,
    formatDate(-1),
    1,
    formatDateTime(-1),
    formatDateTime(-1),
    'weekly'
  ],
  [
    4,
    'Clean kitchen oven and microwave',
    'Apply oven cleaner spray and wipe down all interior glass/racks.',
    'medium',
    1, // Cleaning
    'members',
    null,
    formatDate(-1),
    1,
    formatDateTime(-1),
    formatDateTime(-1),
    'none'
  ],
  [
    5,
    'Weekly grocery shopping run',
    'Pick up fresh produce, bakery loaves, and dairy essentials from the local organic market.',
    'medium',
    4, // Groceries
    'members',
    null,
    formatDate(0),
    0,
    null,
    formatDateTime(0),
    'weekly'
  ],
  [
    6,
    'Vacuum and dust the living room',
    'Clean the rugs, wipe the TV console, and dust the shelves.',
    'small',
    1, // Cleaning
    'members',
    null,
    formatDate(0),
    0,
    null,
    formatDateTime(0),
    'weekly'
  ],
  [
    7,
    'Fix the leaking guest bathroom sink',
    'The cold water valve is dripping slowly. Plumber Joe is scheduled to visit at 2:00 PM.',
    'big',
    2, // Maintenance
    'other',
    'Plumber Joe',
    formatDate(1),
    0,
    null,
    formatDateTime(0),
    'none'
  ],
  [
    8,
    'Wash the family SUV',
    'Exterior wash, tire shine, and interior vacuuming.',
    'small',
    1, // Cleaning
    'members',
    null,
    formatDate(1),
    0,
    null,
    formatDateTime(0),
    'weekly'
  ],
  [
    9,
    'Prepare Sunday family roast dinner',
    'Roast chicken with herb potatoes, vegetables, and apple pie for dessert.',
    'medium',
    5, // Cooking
    'members',
    null,
    formatDate(2),
    0,
    null,
    formatDateTime(0),
    'weekly'
  ],
  [
    10,
    'Trim garden hedges & shrubs',
    'Prune the boundary hedges and roses.',
    'medium',
    3, // Gardening
    'members',
    null,
    formatDate(5),
    0,
    null,
    formatDateTime(0),
    'bi-weekly'
  ],
  [
    11,
    'Organize pantry shelves',
    'Sort cans, check expiry dates, and clean up spice racks.',
    'small',
    5, // Cooking
    'unassigned',
    null,
    formatDate(3),
    0,
    null,
    null,
    'monthly'
  ],
  [
    12,
    'Check smoke detector batteries',
    'Test alarms and replace any dead backup batteries.',
    'small',
    2, // Maintenance
    'members',
    null,
    formatDate(7),
    0,
    null,
    formatDateTime(0),
    'quarterly'
  ]
];

const insertTask = db.prepare(`
  INSERT INTO tasks (
    id, title, description, size, category_id, assigned_type, other_assignee,
    deadline, completed, completed_at, assigned_at, recurrence
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

tasksToInsert.forEach((t) => {
  insertTask.run(...t);
});

// Seed task_members (task_id, member_id)
// Members mapping: 1=Mom, 2=Dad, 3=Kids, 4=Emily
const taskMembersToInsert = [
  [1, 2], // Task 1 (BBQ grill) -> Dad
  [2, 4], // Task 2 (Wi-Fi password) -> Emily
  [3, 3], // Task 3 (Mow lawns) -> Kids
  [4, 1], // Task 4 (Clean oven) -> Mom
  [5, 1], // Task 5 (Grocery run) -> Mom
  [6, 4], // Task 6 (Vacuum) -> Emily
  [8, 3], // Task 8 (SUV wash) -> Kids
  [9, 1], // Task 9 (Sunday dinner) -> Mom
  [9, 2], // Task 9 (Sunday dinner) -> Dad (assigned to both Mom & Dad!)
  [10, 2], // Task 10 (Hedges) -> Dad
  [10, 3], // Task 10 (Hedges) -> Kids (assigned to both Kids & Dad!)
  [12, 2] // Task 12 (Smoke alarms) -> Dad
];

const insertTaskMember = db.prepare('INSERT INTO task_members (task_id, member_id) VALUES (?, ?)');
taskMembersToInsert.forEach((tm) => {
  insertTaskMember.run(tm[0], tm[1]);
});

// 8. Seed Memos
const memosToInsert = [
  // content, color, event_date
  [
    "🦷 Emily's Dentist Appt at 2:30 PM\nDr. Jenkins office - bring insurance card.",
    '#bfdbfe', // blue
    formatDate(3)
  ],
  [
    "🎂 Grandma's Birthday!\nDon't forget to call her in the morning!",
    '#fbcfe8', // pink
    formatDate(2)
  ],
  [
    '🚛 Garbage & Recycling\nPut bins out on Monday night!',
    '#fed7aa', // orange
    formatDate(4)
  ],
  [
    '🎹 Piano tuning at 10:00 AM.',
    '#ddd6fe', // purple
    formatDate(6)
  ],
  [
    '📡 Wi-Fi Info:\nSSID: FamilyNet_5G\nPass: SweetHome2026!',
    '#fef08a', // yellow
    null
  ],
  [
    '🚨 Emergency Contacts:\n- Pediatrician: 555-0199\n- Poison Control: 555-0122\n- Neighbor (Clara): 555-0145',
    '#fecdd3', // rose
    null
  ],
  [
    '🌱 Summer Watering:\nOnly water lawns on Tuesdays & Thursdays after 7 PM per city guidelines.',
    '#bbf7d0', // green
    null
  ]
];

const insertMemo = db.prepare('INSERT INTO memos (content, color, event_date) VALUES (?, ?, ?)');
memosToInsert.forEach((m) => {
  insertMemo.run(m[0], m[1], m[2]);
});

// 9. Seed Shopping Items
const shoppingItemsToInsert = [
  // name, quantity, category, checked, list_id
  ['Bananas', '1 bunch', 'Produce', 0, 1],
  ['Whole Milk', '2 gallons', 'Dairy', 1, 1],
  ['Sourdough Bread', '1 loaf', 'Bakery', 0, 1],
  ['Greek Yogurt', '3 tubs', 'Dairy', 0, 1],
  ['Olive Oil', '1 bottle', 'Pantry', 1, 1],
  ['Dishwasher Pods', '1 pack', 'Household', 0, 1],

  ['Toilet Paper', '1 large pack', 'Household', 0, 2],
  ['Paper Towels', '1 pack', 'Household', 0, 2],
  ['Chicken Breasts', '5 lbs', 'Meat', 0, 2],
  ['Organic Eggs', '24 pack', 'Dairy', 1, 2],
  ['Avocados', '1 bag', 'Produce', 0, 2],

  ['Potting Soil', '3 bags', 'Other', 0, 3],
  ['LED Light Bulbs', '1 pack', 'Other', 0, 3],
  ['Garden Hose Nozzle', '1', 'Other', 1, 3]
];

const insertShoppingItem = db.prepare(`
  INSERT INTO shopping_items (name, quantity, category, checked, list_id)
  VALUES (?, ?, ?, ?, ?)
`);
shoppingItemsToInsert.forEach((item) => {
  insertShoppingItem.run(...item);
});

db.close();
console.log('Seeded database at:', dbPath);
