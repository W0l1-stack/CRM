const { subscriber } = require('../redis/client');
const pool = require('../db');
const logger = require('../logger');
const { enqueueEmail } = require('../queues/email.queue');

const CAMPAIGN_CHANNEL = 'lydia:campaigns';
// Where the public unsubscribe link points (the Go API).
const apiBase = process.env.API_PUBLIC_URL || 'http://localhost:3001';

function render(template, contact) {
  return String(template || '').replace(/\{\{\s*contact\.(\w+)\s*\}\}/g, (_m, k) =>
    contact && contact[k] != null ? String(contact[k]) : ''
  );
}

// Resolve recipients and enqueue one email per contact, with per-recipient
// variable substitution and a CAN-SPAM unsubscribe link.
async function sendCampaign(accountID, campaignId) {
  const c = await pool.query(
    `SELECT name, subject, body_html, recipient_filter FROM campaigns WHERE account_id = $1 AND id = $2`,
    [accountID, campaignId]
  );
  if (c.rowCount === 0) return;
  const camp = c.rows[0];
  const filter = camp.recipient_filter || {};

  const params = [accountID];
  let q = `SELECT id, name, email FROM contacts
            WHERE account_id = $1 AND is_unsubscribed = FALSE AND email IS NOT NULL AND email <> ''`;
  if (filter.tag) {
    params.push(filter.tag);
    q += ` AND $${params.length} = ANY(tags)`;
  }
  const recipients = await pool.query(q, params);

  let sent = 0;
  for (const contact of recipients.rows) {
    const unsub = `${apiBase}/api/v1/public/unsubscribe?a=${accountID}&c=${contact.id}`;
    const html =
      render(camp.body_html, contact) +
      `<hr/><p style="font-size:12px;color:#888">Don't want these emails? <a href="${unsub}">Unsubscribe</a>.</p>`;
    await enqueueEmail({ accountID, data: { to: contact.email, subject: render(camp.subject, contact), html } });
    sent++;
  }

  await pool.query(
    `UPDATE campaigns SET status = 'sent', sent_at = NOW(),
        stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{sent}', to_jsonb($3::int)), updated_at = NOW()
      WHERE account_id = $1 AND id = $2`,
    [accountID, campaignId, sent]
  );
  logger.info({ accountID, campaignId, recipients: sent }, 'campaign queued for delivery');
}

function startCampaignConsumer() {
  subscriber.subscribe(CAMPAIGN_CHANNEL, (err) => {
    if (err) {
      logger.error({ err: err.message }, 'campaign subscribe failed');
      return;
    }
    logger.info('subscribed to campaign channel');
  });

  subscriber.on('message', async (channel, message) => {
    if (channel !== CAMPAIGN_CHANNEL) return;
    try {
      const { account_id: accountID, campaign_id: campaignId } = JSON.parse(message);
      await sendCampaign(accountID, campaignId);
    } catch (err) {
      logger.error({ err: err.message }, 'campaign send failed');
    }
  });
}

module.exports = { startCampaignConsumer };
