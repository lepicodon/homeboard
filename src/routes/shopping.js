const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Categories
router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM shopping_categories ORDER BY name ASC').all();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/categories', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Category name is required.' });
  }
  try {
    const info = db.prepare('INSERT INTO shopping_categories (name) VALUES (?)').run(name.trim());
    res.status(201).json({ id: info.lastInsertRowid, name: name.trim() });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Shopping Category already exists.' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

router.put('/categories/:id', (req, res) => {
  const { name } = req.body;
  const { id } = req.params;
  if (!name) {
    return res.status(400).json({ error: 'Category name is required.' });
  }
  try {
    const oldCategory = db.prepare('SELECT name FROM shopping_categories WHERE id = ?').get(id);
    if (!oldCategory) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    const updateTx = db.transaction(() => {
      db.prepare('UPDATE shopping_categories SET name = ? WHERE id = ?').run(name.trim(), id);
      db.prepare('UPDATE shopping_items SET category = ? WHERE category = ?').run(name.trim(), oldCategory.name);
    });

    updateTx();
    res.json({ id: Number(id), name: name.trim() });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Shopping Category already exists.' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

router.delete('/categories/:id', (req, res) => {
  const { id } = req.params;
  try {
    const oldCategory = db.prepare('SELECT name FROM shopping_categories WHERE id = ?').get(id);
    if (!oldCategory) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM shopping_categories WHERE id = ?').run(id);
      db.prepare("UPDATE shopping_items SET category = 'Other' WHERE category = ?").run(oldCategory.name);
    });

    deleteTx();
    res.json({ message: 'Shopping category deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lists
router.get('/lists', (req, res) => {
  try {
    const lists = db.prepare('SELECT * FROM shopping_lists ORDER BY id ASC').all();
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/lists', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'List name is required.' });
  }
  try {
    const info = db.prepare('INSERT INTO shopping_lists (name) VALUES (?)').run(name.trim());
    res.status(201).json({ id: info.lastInsertRowid, name: name.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/lists/:id', (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === 1) {
    return res.status(400).json({ error: 'The default shopping list cannot be deleted.' });
  }
  try {
    const info = db.prepare('DELETE FROM shopping_lists WHERE id = ?').run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Shopping list not found.' });
    }
    res.json({ message: 'Shopping list deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Items
router.get('/', (req, res) => {
  const listId = req.query.list_id ? parseInt(req.query.list_id) : 1;
  try {
    const items = db
      .prepare('SELECT * FROM shopping_items WHERE list_id = ? ORDER BY checked ASC, name ASC')
      .all(listId);
    res.json(
      items.map((item) => {
        item.checked = !!item.checked;
        return item;
      })
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const { name, quantity, category, list_id } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Item name is required.' });
  }
  const listId = list_id ? parseInt(list_id) : 1;
  try {
    const info = db
      .prepare('INSERT INTO shopping_items (name, quantity, category, list_id) VALUES (?, ?, ?, ?)')
      .run(name.trim(), quantity ? quantity.trim() : null, category || 'Other', listId);
    res.status(201).json({
      id: info.lastInsertRowid,
      name: name.trim(),
      quantity: quantity ? quantity.trim() : null,
      category: category || 'Other',
      list_id: listId,
      checked: false
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/toggle', (req, res) => {
  const { id } = req.params;
  try {
    const item = db.prepare('SELECT checked FROM shopping_items WHERE id = ?').get(id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    const nextChecked = item.checked ? 0 : 1;
    db.prepare('UPDATE shopping_items SET checked = ? WHERE id = ?').run(nextChecked, id);

    const updated = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(id);
    updated.checked = !!updated.checked;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  try {
    const info = db.prepare('DELETE FROM shopping_items WHERE id = ?').run(id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    res.json({ message: 'Item deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/clear-completed', (req, res) => {
  const listId = req.query.list_id ? parseInt(req.query.list_id) : 1;
  try {
    const info = db.prepare('DELETE FROM shopping_items WHERE checked = 1 AND list_id = ?').run(listId);
    res.json({ message: 'Cleared completed items successfully.', clearedCount: info.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
