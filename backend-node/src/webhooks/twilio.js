const express = require('express');
const twilio = require('twilio');
const pool = require('../db');
const config = require('../config');
const logger = require('../logger');
const { publishEvent } = require('../events/publisher');

const router = express.Router();

// POST /webhooks/twilio/sms — inbound SMS. Twilio posts urlencoded form data.
// We map the sender to a contact (and thus an account), append the message to
// an open SMS conversation, and push it to the account's room in real time.
router.post('/twilio/sms', express.urlencoded({ extended: false }), async (req, res) => {
  if (config.twilio.authToken && config.publicUrl) {
    const signature = req.headers['x-twilio-signature'];
    const url = config.publicUrl + req.originalUrl;
    const valid = twilio.validateRequest(config.twilio.authToken, signature, url, req.body);
    if (!valid) {
      logger.warn('rejected inbound sms: invalid twilio signature');
      return res.status(403).send('invalid signature');
    }
  }

  const from = req.body.From;
  const body = req.body.Body || '';
  const sid = req.body.MessageSid;

  try {
    const contact = await pool.query(
      `SELECT id, account_id FROM contacts WHERE phone = $1 ORDER BY created_at ASC LIMIT 1`,
      [from]
    );
    if (contact.rowCount === 0) {
      logger.warn({ from }, 'inbound sms from unknown number, ignoring');
      return res.type('text/xml').send('<Response/>');
    }
    const { id: contactId, account_id: accountID } = contact.rows[0];

    const existing = await pool.query(
      `SELECT id FROM conversations
        WHERE account_id = $1 AND contact_id = $2 AND channel = 'sms'
        ORDER BY created_at DESC LIMIT 1`,
      [accountID, contactId]
    );
    let conversationId;
    if (existing.rowCount > 0) {
      conversationId = existing.rows[0].id;
    } else {
      const created = await pool.query(
        `INSERT INTO conversations (account_id, contact_id, channel, status)
         VALUES ($1, $2, 'sms', 'open') RETURNING id`,
        [accountID, contactId]
      );
      conversationId = created.rows[0].id;
    }

    const msg = await pool.query(
      `INSERT INTO messages (account_id, conversation_id, direction, channel, content, status, external_id)
       VALUES ($1, $2, 'inbound', 'sms', $3, 'delivered', $4)
       RETURNING id, created_at`,
      [accountID, conversationId, body, sid]
    );
    await pool.query(
      `UPDATE conversations SET last_message_at = $3, status = 'open', updated_at = NOW()
        WHERE account_id = $1 AND id = $2`,
      [accountID, conversationId, msg.rows[0].created_at]
    );

    await publishEvent(accountID, 'message:created', {
      conversation_id: conversationId,
      message: {
        id: msg.rows[0].id,
        conversation_id: conversationId,
        direction: 'inbound',
        channel: 'sms',
        content: body,
        status: 'delivered',
        created_at: msg.rows[0].created_at,
      },
    });

    logger.info({ accountID, conversationId, from }, 'inbound sms stored and broadcast');
    res.type('text/xml').send('<Response/>');
  } catch (err) {
    logger.error({ err: err.message }, 'inbound sms handling failed');
    res.status(500).send('error');
  }
});

module.exports = router;
