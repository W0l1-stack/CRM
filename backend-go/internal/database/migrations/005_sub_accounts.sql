-- ============================================================
-- SUB-ACCOUNTS (agency model)
-- An agency's own account is the "parent"; each client workspace
-- is a separate account with parent_account_id set. organization_id
-- groups an agency and all its sub-accounts under one umbrella.
-- All existing queries already scope by account_id, so sub-accounts
-- are fully isolated — this only adds the hierarchy above.
-- ============================================================
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS parent_account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS organization_id UUID;

CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_account_id);
