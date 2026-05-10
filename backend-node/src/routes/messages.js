const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Send message
router.post('/', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { contact_id, type, content } = req.body;

  try {
    const id = uuidv4();
    const stmt = db.prepare(
      'INSERT INTO messages (id, user_id, contact_id, type, content) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(id, userId, contact_id, type, content);
    res.status(201).json({ id, user_id: userId, contact_id, type, content });
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get messages for contact
router.get('/contact/:contact_id', (req, res) => {
  const userId = req.headers['x-user-id'];
  const { contact_id } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const stmt = db.prepare(
      'SELECT * FROM messages WHERE user_id = ? AND contact_id = ? ORDER BY created_at ASC'
    );
    const messages = stmt.all(userId, contact_id);
    res.json(messages || []);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

module.exports = router;
