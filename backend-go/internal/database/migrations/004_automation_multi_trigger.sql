-- ============================================================
-- AUTOMATION MULTI-TRIGGER — an automation can now fire on any
-- of several trigger types ("when contact created OR form
-- submitted -> do these actions"). Replaces the single
-- trigger_type column with a trigger_types array; the engine
-- matches an incoming event with `event_type = ANY(trigger_types)`.
-- ============================================================
ALTER TABLE automations ADD COLUMN IF NOT EXISTS trigger_types TEXT[] NOT NULL DEFAULT '{}';

-- Backfill the array from the legacy single column for existing rows.
UPDATE automations
   SET trigger_types = ARRAY[trigger_type]
 WHERE array_length(trigger_types, 1) IS NULL
   AND trigger_type IS NOT NULL
   AND trigger_type <> '';

-- The legacy column is no longer required (kept for historical rows).
ALTER TABLE automations ALTER COLUMN trigger_type DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_automations_trigger_types ON automations USING GIN(trigger_types);
