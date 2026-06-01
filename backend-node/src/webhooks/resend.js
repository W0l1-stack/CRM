const express = require('express');
const pool = require('../db');
const logger = require('../logger');
const { publishEvent } = require('../events/publisher');

const router = express.Router();

// Map Resend webhook event types to our message.status values.
const STATUS_MAP = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.opened': 'read',
  'email.bounced': 'failed',
  'email.complained': 'failed',
};

// POST /webhooks/resend — delivery events. We update the matching message
// (by external_id = Resend message id) and notify the account room.
router.post('/resend', express.json(), async (req, res) => {
  const type = req.body?.type;
  const emailId = req.body?.data?.email_id;
  const status = STATUS_MAP[type];

  if (!emailId || !status) {
    return res.json({ ok: true }); // ignore events we don't track
  }

  try {
    const updated = await pool.query(
      `UPDATE messages SET status = $1 WHERE external_id = $2
       RETURNING account_id, id, conversation_id`,
      [status, emailId]
    );
    if (updated.rowCount > 0) {
      const row = updated.rows[0];
      await publishEvent(row.account_id, 'message:updated', {
        id: row.id,
        conversation_id: row.conversation_id,
        status,
      });
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err.message }, 'resend webhook handling failed');
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
