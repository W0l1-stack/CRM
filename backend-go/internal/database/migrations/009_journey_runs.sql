-- ============================================================
-- JOURNEY RUNS — per-contact automation state. An automation now
-- runs as a "journey": each enrolled contact gets a run that walks
-- a queue of remaining actions, pausing on waits and on response
-- branches (wait for SMS reply / email click) until the event
-- arrives or the wait times out. This powers response-based,
-- multi-way branching across automations / pipeline triggers.
-- ============================================================
CREATE TABLE IF NOT EXISTS journey_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  contact JSONB NOT NULL DEFAULT '{}',     -- snapshot for rendering + conditions
  pending JSONB NOT NULL DEFAULT '[]',      -- remaining action queue
  status TEXT NOT NULL DEFAULT 'active',    -- active, waiting, waiting_event, done
  wait_event TEXT,                          -- 'replied' | 'clicked' when paused on a response
  wait_seq INTEGER NOT NULL DEFAULT 0,      -- dedupes a timeout vs an event resume
  wait_action JSONB,                        -- the wait_event step (its on_event/on_timeout paths)
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journey_runs_wait
  ON journey_runs(account_id, contact_id, status, wait_event);
