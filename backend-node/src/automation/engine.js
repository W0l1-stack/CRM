const pool = require('../db');
const logger = require('../logger');
const { startRun } = require('./journey');

// loadContact normalizes the trigger payload into a single contact object and
// enriches it from the DB (tags, custom_fields, company, source) so conditions
// and sends have the full record. contact_created sends the contact directly;
// form/appointment wrap it under `contact`; deal_moved references deal.contact_id.
async function loadContact(accountID, payload) {
  let contact = (payload && payload.contact) || payload || {};
  const contactId = contact.id || (payload && payload.deal && payload.deal.contact_id);
  if (contactId) {
    try {
      const r = await pool.query(
        `SELECT id, name, email, phone, company, source, tags, custom_fields
           FROM contacts WHERE account_id = $1 AND id = $2`,
        [accountID, contactId]
      );
      if (r.rowCount > 0) contact = { ...contact, ...r.rows[0] };
    } catch (err) {
      logger.warn({ accountID, err: err.message }, 'automation contact enrich failed');
    }
  }
  return contact;
}

// runTrigger enrolls the contact into every matching active automation as a
// journey run (which handles ordering, waits, data branches and response
// branches). Used for all triggers, including deal_moved (pipeline automation).
async function runTrigger({ accountID, triggerType, payload }) {
  if (!accountID || !triggerType) return;

  const { rows } = await pool.query(
    `SELECT id, name, actions FROM automations
      WHERE account_id = $1 AND is_active = TRUE AND $2 = ANY(trigger_types)`,
    [accountID, triggerType]
  );
  if (rows.length === 0) return;

  const contact = await loadContact(accountID, payload);
  for (const auto of rows) {
    await startRun(accountID, auto, contact);
    logger.info({ accountID, automationId: auto.id, triggerType }, 'journey started');
  }
}

module.exports = { runTrigger };
