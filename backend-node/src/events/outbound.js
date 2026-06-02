const { subscriber } = require('../redis/client');
const pool = require('../db');
const logger = require('../logger');
const { enqueueEmail } = require('../queues/email.queue');
const { enqueueSms } = require('../queues/sms.queue');

const OUTBOUND_CHANNEL = 'lydia:outbound';

// Resolve a stored outbound message to a recipient and enqueue the actual send.
async function sendOutbound(accountID, messageId) {
  const { rows } = await pool.query(
    `SELECT m.channel, m.content, conv.subject, c.email, c.phone
       FROM messages m
       JOIN conversations conv ON conv.id = m.conversation_id
       JOIN contacts c ON c.id = conv.contact_id
      WHERE m.account_id = $1 AND m.id = $2`,
    [accountID, messageId]
  );
  if (rows.length === 0) return;

  const { channel, content, subject, email, phone } = rows[0];
  if (channel === 'email') {
    if (!email) {
      logger.warn({ messageId }, 'outbound email skipped: contact has no email');
      return;
    }
    await enqueueEmail({ accountID, data: { to: email, subject: subject || 'New message', html: content, messageId } });
  } else if (channel === 'sms') {
    if (!phone) {
      logger.warn({ messageId }, 'outbound sms skipped: contact has no phone');
      return;
    }
    await enqueueSms({ accountID, data: { to: phone, body: content, messageId } });
  }
  logger.info({ accountID, messageId, channel }, 'outbound message enqueued for delivery');
}

// startOutboundConsumer listens for send requests from the Go API.
function startOutboundConsumer() {
  subscriber.subscribe(OUTBOUND_CHANNEL, (err) => {
    if (err) {
      logger.error({ err: err.message }, 'outbound subscribe failed');
      return;
    }
    logger.info('subscribed to outbound message channel');
  });

  subscriber.on('message', async (channel, message) => {
    if (channel !== OUTBOUND_CHANNEL) return;
    try {
      const { account_id: accountID, message_id: messageId } = JSON.parse(message);
      await sendOutbound(accountID, messageId);
    } catch (err) {
      logger.error({ err: err.message }, 'outbound handling failed');
    }
  });
}

module.exports = { startOutboundConsumer, OUTBOUND_CHANNEL };
