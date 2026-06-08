const pool = require('../db');
const logger = require('../logger');
const { enqueueEmail } = require('../queues/email.queue');
const { enqueueSms } = require('../queues/sms.queue');

const apiBase = process.env.API_PUBLIC_URL || 'http://localhost:3001';

// Substitute {{contact.field}} and the short {{field}} form (e.g. {{name}},
// {{company_name}}) with the contact's value. Unknown tokens render empty.
function render(template, contact) {
  return String(template || '').replace(/\{\{\s*(?:contact\.)?(\w+)\s*\}\}/g, (_m, key) => {
    const k = key === 'company_name' ? 'company' : key === 'full_name' ? 'name' : key;
    return contact && contact[k] != null ? String(contact[k]) : '';
  });
}

async function markSent(accountID, campaignId, sent) {
  await pool.query(
    `UPDATE campaigns SET status = 'sent', sent_at = NOW(),
        stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{sent}', to_jsonb($3::int)), updated_at = NOW()
      WHERE account_id = $1 AND id = $2`,
    [accountID, campaignId, sent]
  );
}

// sendEmailCampaign enqueues one email per contact with variable substitution
// and a CAN-SPAM unsubscribe link.
async function sendEmailCampaign(accountID, campaignId, camp, filter) {
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

    await pool.query(
      `INSERT INTO campaign_recipients (account_id, campaign_id, contact_id, email, status)
       VALUES ($1, $2, $3, $4, 'sent')
       ON CONFLICT (campaign_id, contact_id) DO UPDATE SET status = 'sent', sent_at = NOW()`,
      [accountID, campaignId, contact.id, contact.email]
    );

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
  return sent;
}

// sendSmsCampaign enqueues one SMS per contact that has a phone number. body_html
// holds the plain message text; {{contact.name}} is substituted per recipient.
async function sendSmsCampaign(accountID, campaignId, camp, filter) {
  const params = [accountID];
  let q = `SELECT id, name, email, phone FROM contacts
            WHERE account_id = $1 AND is_unsubscribed = FALSE AND phone IS NOT NULL AND phone <> ''`;
  if (filter.tag) {
    params.push(filter.tag);
    q += ` AND $${params.length} = ANY(tags)`;
  }
  const recipients = await pool.query(q, params);

  let sent = 0;
  for (const contact of recipients.rows) {
    await pool.query(
      `INSERT INTO campaign_recipients (account_id, campaign_id, contact_id, email, phone, status)
       VALUES ($1, $2, $3, $4, $5, 'sent')
       ON CONFLICT (campaign_id, contact_id) DO UPDATE SET status = 'sent', sent_at = NOW()`,
      [accountID, campaignId, contact.id, contact.email || null, contact.phone]
    );
    await enqueueSms({ accountID, data: { to: contact.phone, body: render(camp.body_html, contact) } });
    sent++;
  }
  return sent;
}

// sendCampaign resolves recipients and delivers via the campaign's channel
// (email through Resend, SMS through Twilio), then marks it sent.
async function sendCampaign(accountID, campaignId) {
  const c = await pool.query(
    `SELECT name, subject, body_html, channel, recipient_filter FROM campaigns WHERE account_id = $1 AND id = $2`,
    [accountID, campaignId]
  );
  if (c.rowCount === 0) return;
  const camp = c.rows[0];
  const filter = camp.recipient_filter || {};

  const sent =
    camp.channel === 'sms'
      ? await sendSmsCampaign(accountID, campaignId, camp, filter)
      : await sendEmailCampaign(accountID, campaignId, camp, filter);

  await markSent(accountID, campaignId, sent);
  logger.info({ accountID, campaignId, channel: camp.channel || 'email', recipients: sent }, 'campaign queued for delivery');
}

module.exports = { sendCampaign };
