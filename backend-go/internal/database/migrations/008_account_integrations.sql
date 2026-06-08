-- ============================================================
-- ACCOUNT INTEGRATIONS — bring-your-own provider credentials.
-- Each account can connect its own SMS and email provider
-- (Twilio/Vonage/MessageBird for sms, Resend/SendGrid/Mailgun
-- for email). Secrets are stored encrypted in config_enc; the
-- non-secret "from" value is kept plain for display. One active
-- provider per kind per account.
-- ============================================================
CREATE TABLE IF NOT EXISTS account_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                 -- 'sms' | 'email'
  provider TEXT NOT NULL,             -- twilio, vonage, messagebird, resend, sendgrid, mailgun
  config_enc TEXT NOT NULL,           -- AES-GCM encrypted JSON of the credentials
  from_value TEXT,                    -- from number / from email (not secret)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_account_integrations_account ON account_integrations(account_id);
