-- ============================================================
-- GOOGLE CALENDAR INTEGRATION — one connection per account
-- Stores OAuth tokens so Lydia can read free/busy and create
-- events on the connected calendar. Tokens are account-scoped.
-- ============================================================
CREATE TABLE IF NOT EXISTS google_integrations (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  google_email TEXT,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link booked appointments to the Google event they create (for two-way sync).
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_event_id TEXT;
