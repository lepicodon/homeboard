const express = require('express');
const router = express.Router();
const db = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/', asyncHandler(async (req, res) => {
  const memos = db.prepare('SELECT * FROM memos ORDER BY created_at DESC').all();
  res.json(memos);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { content, color, event_date } = req.body;
  if (!content) {
    return res.status(400).json({ error: 'Memo content is required.' });
  }
  const info = db
    .prepare('INSERT INTO memos (content, color, event_date) VALUES (?, ?, ?)')
    .run(content.trim(), color || '#fef08a', event_date || null);
  res.status(201).json({ id: info.lastInsertRowid, content: content.trim(), color: color || '#fef08a', event_date });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { content, color, event_date } = req.body;
  const { id } = req.params;
  if (!content) {
    return res.status(400).json({ error: 'Memo content is required.' });
  }
  const info = db
    .prepare('UPDATE memos SET content = ?, color = ?, event_date = ? WHERE id = ?')
    .run(content.trim(), color || '#fef08a', event_date || null, id);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Memo not found.' });
  }
  res.json({ id: Number(id), content: content.trim(), color: color || '#fef08a', event_date });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const info = db.prepare('DELETE FROM memos WHERE id = ?').run(req.params.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: 'Memo not found.' });
  }
  res.json({ message: 'Memo deleted successfully.' });
}));

module.exports = router;
