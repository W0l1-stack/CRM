-- ============================================================
-- DELETE CONSTRAINTS — make permanent (hard) deletes safe.
-- Records that reference a user are reassigned to NULL when that
-- user is deleted; records that belong to a contact or pipeline
-- are removed when the parent is deleted. Each constraint is
-- dropped (IF EXISTS) then re-added, so this migration is
-- idempotent and safe to re-run.
-- ============================================================

-- ---- References to users(id): set NULL so the user can be deleted ----
ALTER TABLE contacts          DROP CONSTRAINT IF EXISTS contacts_assigned_to_fkey;
ALTER TABLE contacts          ADD  CONSTRAINT contacts_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE deals             DROP CONSTRAINT IF EXISTS deals_assigned_to_fkey;
ALTER TABLE deals             ADD  CONSTRAINT deals_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE conversations     DROP CONSTRAINT IF EXISTS conversations_assigned_to_fkey;
ALTER TABLE conversations     ADD  CONSTRAINT conversations_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE messages          DROP CONSTRAINT IF EXISTS messages_sent_by_fkey;
ALTER TABLE messages          ADD  CONSTRAINT messages_sent_by_fkey
  FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE campaigns         DROP CONSTRAINT IF EXISTS campaigns_created_by_fkey;
ALTER TABLE campaigns         ADD  CONSTRAINT campaigns_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE appointment_types DROP CONSTRAINT IF EXISTS appointment_types_assigned_to_fkey;
ALTER TABLE appointment_types ADD  CONSTRAINT appointment_types_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE appointments      DROP CONSTRAINT IF EXISTS appointments_assigned_to_fkey;
ALTER TABLE appointments      ADD  CONSTRAINT appointments_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- ---- References to contacts(id): cascade so deleting a contact removes its records ----
ALTER TABLE deals             DROP CONSTRAINT IF EXISTS deals_contact_id_fkey;
ALTER TABLE deals             ADD  CONSTRAINT deals_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;

ALTER TABLE conversations     DROP CONSTRAINT IF EXISTS conversations_contact_id_fkey;
ALTER TABLE conversations     ADD  CONSTRAINT conversations_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;

ALTER TABLE appointments      DROP CONSTRAINT IF EXISTS appointments_contact_id_fkey;
ALTER TABLE appointments      ADD  CONSTRAINT appointments_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;

-- ---- References to pipelines(id): cascade so deleting a pipeline removes its deals ----
ALTER TABLE deals             DROP CONSTRAINT IF EXISTS deals_pipeline_id_fkey;
ALTER TABLE deals             ADD  CONSTRAINT deals_pipeline_id_fkey
  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE;

-- ---- References to appointment_types(id): set NULL so the type can be deleted ----
ALTER TABLE appointments      DROP CONSTRAINT IF EXISTS appointments_appointment_type_id_fkey;
ALTER TABLE appointments      ADD  CONSTRAINT appointments_appointment_type_id_fkey
  FOREIGN KEY (appointment_type_id) REFERENCES appointment_types(id) ON DELETE SET NULL;
