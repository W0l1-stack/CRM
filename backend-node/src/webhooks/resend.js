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

// Pull a tag value (e.g. campaign_id) out of a Resend webhook payload. Resend
// echoes the tags we set at send time on every event for that email; depending
// on API version they arrive as an object map or an array of {name, value}.
function tagValue(data, name) {
  const tags = data?.tags;
  if (!tags) return null;
  if (Array.isArray(tags)) {
    const found = tags.find((t) => t.name === name);
    return found ? found.value : null;
  }
  return tags[name] || null;
}

// Record a campaign open/click and bump the campaign's aggregate stats. The
// recipient row is keyed by (campaign_id, contact_id) from the email tags.
async function trackCampaignEvent(type, data) {
  const campaignId = tagValue(data, 'campaign_id');
  const contactId = tagValue(data, 'contact_id');
  if (!campaignId || !contactId) return;

  const isClick = type === 'email.clicked';
  const tsCol = isClick ? 'clicked_at' : 'opened_at';
  const newStatus = isClick ? 'clicked' : 'opened';

  // Only count the first open and first click per recipient so stats don't
  // inflate on repeated events.
  const updated = await pool.query(
    `UPDATE campaign_recipients
        SET ${tsCol} = COALESCE(${tsCol}, NOW()),
            status = CASE WHEN $3 = 'clicked' THEN 'clicked'
                         WHEN status = 'clicked' THEN status ELSE 'opened' END
      WHERE campaign_id = $1 AND contact_id = $2 AND ${tsCol} IS NULL
      RETURNING account_id`,
    [campaignId, contactId, newStatus]
  );
  if (updated.rowCount === 0) return; // already counted

  const statKey = isClick ? 'clicks' : 'opens';
  await pool.query(
    `UPDATE campaigns
        SET stats = jsonb_set(
              COALESCE(stats, '{}'::jsonb), '{${statKey}}',
              to_jsonb(COALESCE((stats->>'${statKey}')::int, 0) + 1))
      WHERE id = $1`,
    [campaignId]
  );
}

// POST /webhooks/resend — delivery events. Transactional emails update the
// matching message (by external_id); campaign emails update recipient
// open/click tracking via tags.
router.post('/resend', express.json(), async (req, res) => {
  const type = req.body?.type;
  const data = req.body?.data || {};
  const emailId = data.email_id;
  const status = STATUS_MAP[type];

  try {
    // Campaign open/click tracking (tagged emails).
    if (type === 'email.opened' || type === 'email.clicked') {
      await trackCampaignEvent(type, data);
    }

    // Transactional message status (inbox emails carry no campaign tags).
    if (emailId && status) {
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
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err: err.message }, 'resend webhook handling failed');
    res.status(500).json({ ok: false });
  }
});

module.exports = router;
