-- ============================================================
-- Lydia CRM — initial schema
-- Every tenant-scoped table carries account_id so Customer A
-- can never read Customer B's data.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ACCOUNTS (one per paying customer / business)
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'trial',       -- trial, starter, pro
  trial_ends_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS (people who log into Lydia)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',       -- owner, admin, member
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REFRESH TOKENS (rotating, revocable login sessions)
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTACTS (the people your customers are selling to)
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  source TEXT,                               -- web, import, form, manual
  notes TEXT,
  custom_fields JSONB DEFAULT '{}',          -- flexible per-account fields
  tags TEXT[] DEFAULT '{}',                  -- array of tag strings
  assigned_to UUID REFERENCES users(id),
  is_unsubscribed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PIPELINES (a sales process, e.g. "Sales Pipeline")
-- ============================================================
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stages JSONB NOT NULL DEFAULT '[]',        -- [{"id":"s1","name":"New","order":1}, ...]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DEALS (a specific opportunity in a pipeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  assigned_to UUID REFERENCES users(id),
  name TEXT NOT NULL,
  value NUMERIC(12,2) DEFAULT 0,
  stage_id TEXT NOT NULL,                    -- matches stage id inside pipeline.stages
  probability INTEGER DEFAULT 50,
  close_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONVERSATIONS (one thread per contact — holds all messages)
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  assigned_to UUID REFERENCES users(id),
  channel TEXT NOT NULL,                     -- email, sms, note
  status TEXT NOT NULL DEFAULT 'open',       -- open, resolved, snoozed
  subject TEXT,                              -- for email threads
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES (individual messages inside a conversation)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES users(id),         -- NULL if inbound from contact
  direction TEXT NOT NULL,                   -- inbound, outbound
  channel TEXT NOT NULL,                     -- email, sms, note
  content TEXT NOT NULL,
  status TEXT DEFAULT 'sent',                -- sent, delivered, read, failed
  external_id TEXT,                          -- Twilio SID or Resend message ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CAMPAIGNS (bulk email sends)
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  status TEXT DEFAULT 'draft',               -- draft, scheduled, sending, sent
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  recipient_filter JSONB DEFAULT '{}',       -- smart list filter rules
  stats JSONB DEFAULT '{"sent":0,"opens":0,"clicks":0,"unsubscribes":0}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS appointment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                        -- e.g. "30-min Discovery Call"
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  slug TEXT NOT NULL,                        -- URL-safe name for booking page
  google_calendar_id TEXT,                   -- linked Google calendar
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  appointment_type_id UUID REFERENCES appointment_types(id),
  contact_id UUID REFERENCES contacts(id),
  assigned_to UUID REFERENCES users(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled',           -- scheduled, completed, cancelled, no_show
  notes TEXT,
  google_event_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUTOMATIONS (workflows)
-- ============================================================
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  trigger_type TEXT NOT NULL,                -- contact_created, deal_moved, appointment_booked, form_submitted
  trigger_config JSONB DEFAULT '{}',         -- extra filter rules for the trigger
  actions JSONB NOT NULL DEFAULT '[]',       -- ordered list of action steps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FORMS
-- ============================================================
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]',        -- field definitions
  settings JSONB DEFAULT '{}',               -- redirect URL, thank you message
  submission_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES — speed up every query that filters by account_id
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_account         ON users(account_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user   ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_account      ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tags         ON contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_contacts_custom       ON contacts USING GIN(custom_fields);
CREATE INDEX IF NOT EXISTS idx_deals_account         ON deals(account_id);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline        ON deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_conversations_account ON conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_account     ON campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_appointments_account  ON appointments(account_id);
CREATE INDEX IF NOT EXISTS idx_automations_account   ON automations(account_id);
