const pool = require('../db');
const logger = require('../logger');
const { enqueueAutomationStep } = require('../queues/automation.queue');

// Convert a wait action's config to milliseconds.
function waitMs(config = {}) {
  const days = Number(config.days || 0);
  const hours = Number(config.hours || 0);
  const minutes = Number(config.minutes || 0);
  return (((days * 24 + hours) * 60 + minutes) * 60) * 1000;
}

// Resolve a condition field against the (DB-enriched) contact.
function fieldValue(contact, field) {
  if (!contact || !field) return undefined;
  if (field === 'tags') return Array.isArray(contact.tags) ? contact.tags : [];
  if (contact[field] != null) return contact[field];
  if (contact.custom_fields && contact.custom_fields[field] != null) return contact.custom_fields[field];
  return undefined;
}

// Evaluate one branch case condition against the contact.
function matchesCondition(contact, cond = {}) {
  const op = cond.op || 'has_tag';
  const target = String(cond.value == null ? '' : cond.value).trim().toLowerCase();
  if (op === 'has_tag') {
    const tags = (fieldValue(contact, 'tags') || []).map((t) => String(t).toLowerCase());
    return tags.includes(target);
  }
  const raw = fieldValue(contact, cond.field);
  const v = raw == null ? '' : String(raw).toLowerCase();
  switch (op) {
    case 'equals': return v === target;
    case 'not_equals': return v !== target;
    case 'contains': return target !== '' && v.includes(target);
    case 'not_empty': return Array.isArray(raw) ? raw.length > 0 : v.trim() !== '';
    case 'empty': return Array.isArray(raw) ? raw.length === 0 : v.trim() === '';
    default: return false;
  }
}

// enqueueActions walks an ordered action list. `wait` accumulates a cumulative
// delay; `branch` evaluates its cases against the contact and recurses into the
// first matching case (or the default branch). Everything else is enqueued as a
// single automation:step for the worker to execute. ctx.delayMs carries the
// running delay so steps after a wait are deferred (BullMQ delayed jobs).
async function enqueueActions(actions, ctx) {
  for (const action of Array.isArray(actions) ? actions : []) {
    if (!action || typeof action !== 'object') continue;

    if (action.type === 'wait') {
      ctx.delayMs += waitMs(action.config);
      continue;
    }

    if (action.type === 'branch') {
      const cfg = action.config || {};
      const cases = Array.isArray(cfg.cases) ? cfg.cases : [];
      const matched = cases.find((c) => matchesCondition(ctx.contact, c));
      const chosen = matched ? matched.actions : cfg.default;
      logger.info(
        { accountID: ctx.accountID, automationId: ctx.automationId, branch: matched ? (matched.label || 'case') : 'default' },
        'automation branch evaluated'
      );
      await enqueueActions(chosen, ctx);
      continue;
    }

    await enqueueAutomationStep({
      accountID: ctx.accountID,
      data: { automationId: ctx.automationId, action, contact: ctx.contact },
      delayMs: ctx.delayMs,
    });
  }
}

// loadContact normalizes the trigger payload into a single contact object and
// enriches it from the DB (tags, custom_fields, company, source) so both branch
// conditions and send actions have the full record. contact_created sends the
// contact directly; form/appointment wrap it under `contact`; deal_moved
// references deal.contact_id.
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

// runTrigger finds active automations for the trigger and enqueues their steps,
// resolving branches and waits along the way.
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
    const actions = Array.isArray(auto.actions) ? auto.actions : [];
    const ctx = { accountID, contact, automationId: auto.id, delayMs: 0 };
    await enqueueActions(actions, ctx);
    logger.info({ accountID, automationId: auto.id, triggerType, steps: actions.length }, 'automation triggered');
  }
}

module.exports = { runTrigger };
