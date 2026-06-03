-- ============================================================
-- CAMPAIGN RECIPIENTS — per-contact send/open/click tracking
-- One row per (campaign, contact) emailed. Opens and clicks are
-- recorded from Resend webhook events keyed by the email's tags.
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',   -- sent, delivered, opened, clicked, bounced, unsubscribed
  external_id TEXT,                       -- Resend message id, when known
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  UNIQUE (campaign_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_account  ON campaign_recipients(account_id);
