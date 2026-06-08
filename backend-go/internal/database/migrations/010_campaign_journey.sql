-- ============================================================
-- CAMPAIGN JOURNEYS — a campaign can be a "journey": instead of a
-- one-shot blast it enrolls its audience into an automation, which
-- then runs as a per-contact journey (multi-step, branching, waits,
-- response paths). channel = 'journey' uses automation_id.
-- ============================================================
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS automation_id UUID REFERENCES automations(id) ON DELETE SET NULL;
