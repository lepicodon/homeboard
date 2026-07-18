const express = require('express');
const router = express.Router();
const db = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/', asyncHandler(async (req, res) => {
  const members = db.prepare('SELECT * FROM members ORDER BY name ASC').all();
  res.json(members);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { name, color, avatar } = req.body;
  if (!name || !color) {
    return res.status(400).json({ error: 'Name and color are required.' });
  }
  
  try {
    const info = db
      .prepare('INSERT INTO members (name, color, avatar) VALUES (?, ?, ?)')
      .run(name.trim(), color, avatar || null);
    res.status(201).json({ id: info.lastInsertRowid, name: name.trim(), color, avatar });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Member name already exists.' });
    } else {
      throw err;
    }
  }
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { name, color, avatar } = req.body;
  const { id } = req.params;
  if (!name || !color) {
    return res.status(400).json({ error: 'Name and color are required.' });
  }
  
  try {
    const info = db
      .prepare('UPDATE members SET name = ?, color = ?, avatar = ? WHERE id = ?')
      .run(name.trim(), color, avatar || null, id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Member not found.' });
    }
    res.json({ id: Number(id), name: name.trim(), color, avatar });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Member name already exists.' });
    } else {
      throw err;
    }
  }
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const info = db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Member not found.' });
  }
  res.json({ message: 'Member deleted successfully.' });
}));

module.exports = router;
