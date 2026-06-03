const pool = require('../db');
const logger = require('../logger');
const { enqueueEmail } = require('../queues/email.queue');

const apiBase = process.env.API_PUBLIC_URL || 'http://localhost:3001';

function render(template, contact) {
  return String(template || '').replace(/\{\{\s*contact\.(\w+)\s*\}\}/g, (_m, k) =>
    contact && contact[k] != null ? String(contact[k]) : ''
  );
}

// sendCampaign resolves recipients and enqueues one email per contact, with
// per-recipient variable substitution and a CAN-SPAM unsubscribe link, then
// marks the campaign sent with a recipient count.
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

    // Record one recipient row per contact so the campaign detail page can show
    // per-contact open/click status (updated later from Resend webhook events).
    await pool.query(
      `INSERT INTO campaign_recipients (account_id, campaign_id, contact_id, email, status)
       VALUES ($1, $2, $3, $4, 'sent')
       ON CONFLICT (campaign_id, contact_id) DO UPDATE SET status = 'sent', sent_at = NOW()`,
      [accountID, campaignId, contact.id, contact.email]
    );

    // Tags let the Resend webhook correlate opens/clicks back to this
    // campaign + contact (Resend echoes tags on every event for the email).
    await enqueueEmail({
      accountID,
      data: {
        to: contact.email,
        subject: render(camp.subject, contact),
        html,
        tags: [
          { name: 'campaign_id', value: campaignId },
          { name: 'contact_id', value: contact.id },
        ],
      },
    });
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

module.exports = { sendCampaign };
