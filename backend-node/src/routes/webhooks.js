const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// Create webhooks table if it doesn't exist
const createWebhooksTable = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);
};

createWebhooksTable();

// Create webhook
router.post('/', (req, res) => {
  const userId = req.headers['x-user-id'];
  const { event, url } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const id = uuidv4();
    const stmt = db.prepare(
      'INSERT INTO webhooks (id, user_id, event, url) VALUES (?, ?, ?, ?)'
    );
    stmt.run(id, userId, event, url);
    res.status(201).json({ id, user_id: userId, event, url });
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// List webhooks
router.get('/', (req, res) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const stmt = db.prepare('SELECT * FROM webhooks WHERE user_id = ?');
    const webhooks = stmt.all(userId);
    res.json(webhooks || []);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

module.exports = router;
