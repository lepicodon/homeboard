const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const { name, color } = req.body;
  if (!name || !color) {
    return res.status(400).json({ error: 'Name and color are required.' });
  }
  try {
    const info = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)').run(name.trim(), color);
    res.status(201).json({ id: info.lastInsertRowid, name: name.trim(), color });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Category name already exists.' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

router.put('/:id', (req, res) => {
  const { name, color } = req.body;
  const { id } = req.params;
  if (!name || !color) {
    return res.status(400).json({ error: 'Name and color are required.' });
  }
  try {
    const info = db.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?').run(name.trim(), color, id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }
    res.json({ id: Number(id), name: name.trim(), color });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Category name already exists.' });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

router.delete('/:id', (req, res) => {
  try {
    const info = db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }
    res.json({ message: 'Category deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
