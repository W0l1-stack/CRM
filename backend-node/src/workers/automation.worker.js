const { Worker } = require('bullmq');
const { createBullConnection } = require('../redis/client');
const logger = require('../logger');
const pool = require('../db');
const { enqueueEmail } = require('../queues/email.queue');
const { enqueueSms } = require('../queues/sms.queue');
const { publishEvent } = require('../events/publisher');
const { render } = require('../automation/util');

async function findOrCreateConversation(accountID, contactId, channel) {
  const existing = await pool.query(
    `SELECT id FROM conversations WHERE account_id = $1 AND contact_id = $2 AND channel = $3
      ORDER BY created_at DESC LIMIT 1`,
    [accountID, contactId, channel]
  );
  if (existing.rowCount > 0) return existing.rows[0].id;
  const created = await pool.query(
    `INSERT INTO conversations (account_id, contact_id, channel, status) VALUES ($1, $2, $3, 'open') RETURNING id`,
    [accountID, contactId, channel]
  );
  return created.rows[0].id;
}

async function executeAction(accountID, action, contact) {
  switch (action.type) {
    case 'add_tag': {
      const tag = action.config?.tag;
      if (!tag || !contact?.id) return;
      await pool.query(
        `UPDATE contacts SET tags = array_append(tags, $3), updated_at = NOW()
          WHERE account_id = $1 AND id = $2 AND NOT ($3 = ANY(tags))`,
        [accountID, contact.id, tag]
      );
      await publishEvent(accountID, 'contact:updated', { id: contact.id });
      return;
    }
    case 'send_email': {
      if (!contact?.email || !contact?.id) return;
      const conversationId = await findOrCreateConversation(accountID, contact.id, 'email');
      const subject = render(action.config?.subject, contact);
      const html = render(action.config?.body, contact);
      const msg = await pool.query(
        `INSERT INTO messages (account_id, conversation_id, direction, channel, content, status)
         VALUES ($1, $2, 'outbound', 'email', $3, 'queued') RETURNING id`,
        [accountID, conversationId, html]
      );
      // Tag with contact_id so an email click can resume a "wait for click"
      // response branch (the Resend webhook maps the tag back to the contact).
      await enqueueEmail({
        accountID,
        data: { to: contact.email, subject, html, messageId: msg.rows[0].id, tags: [{ name: 'contact_id', value: String(contact.id) }] },
      });
      return;
    }
    case 'send_sms': {
      if (!contact?.phone || !contact?.id) return;
      const conversationId = await findOrCreateConversation(accountID, contact.id, 'sms');
      const body = render(action.config?.body, contact);
      const msg = await pool.query(
        `INSERT INTO messages (account_id, conversation_id, direction, channel, content, status)
         VALUES ($1, $2, 'outbound', 'sms', $3, 'queued') RETURNING id`,
        [accountID, conversationId, body]
      );
      await enqueueSms({ accountID, data: { to: contact.phone, body, messageId: msg.rows[0].id } });
      return;
    }
    default:
      logger.warn({ type: action.type }, 'unknown automation action, skipping');
  }
}

// startAutomationWorker executes one action per automation:step job. Send
// actions enqueue onto the email/sms queues, so actual delivery runs through
// those workers (and their retries).
function startAutomationWorker() {
  const worker = new Worker(
    'automation',
    async (job) => {
      const { accountID, data } = job.data;
      const action = data?.action || {};
      logger.info({ jobId: job.id, accountID, action: action.type }, 'automation:step start');
      await executeAction(accountID, action, data?.contact);
      logger.info({ jobId: job.id, accountID, action: action.type }, 'automation:step success');
      return { ok: true };
    },
    { connection: createBullConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, accountID: job?.data?.accountID, err: err.message }, 'automation:step failed');
  });

  return worker;
}

module.exports = { startAutomationWorker };
