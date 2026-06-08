const pool = require('../db');
const logger = require('../logger');
const { enqueueAutomationStep } = require('../queues/automation.queue');
const { enqueueJourneyResume } = require('../queues/journey.queue');
const { waitMs, matchesCondition } = require('./util');

// A journey run is a per-contact state machine over an automation's action list.
// `pending` is the queue of remaining actions. The engine pops actions until it
// hits a pause:
//   - wait            → schedule a delayed resume
//   - wait_event      → pause until the contact replies/clicks (or it times out)
// Leaf actions (send_email/send_sms/add_tag) are handed to the existing
// automation:step worker. Data branches resolve immediately and splice the
// chosen path to the front of the queue.

async function loadRun(runId) {
  const { rows } = await pool.query('SELECT * FROM journey_runs WHERE id = $1', [runId]);
  return rows[0] || null;
}

async function startRun(accountID, automation, contact) {
  const actions = Array.isArray(automation.actions) ? automation.actions : [];
  if (actions.length === 0) return;
  const { rows } = await pool.query(
    `INSERT INTO journey_runs (account_id, automation_id, contact_id, contact, pending, status)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 'active') RETURNING id`,
    [accountID, automation.id, contact?.id || null, JSON.stringify(contact || {}), JSON.stringify(actions)]
  );
  await advance(rows[0].id);
}

// advance walks the run's pending queue until it pauses or completes.
async function advance(runId) {
  const run = await loadRun(runId);
  if (!run || run.status === 'done') return;

  const accountID = run.account_id;
  const contact = run.contact || {};
  let pending = Array.isArray(run.pending) ? [...run.pending] : [];
  let seq = run.wait_seq;

  // Safety cap so a malformed loop can't run forever.
  for (let guard = 0; guard < 1000; guard++) {
    if (pending.length === 0) {
      await pool.query(`UPDATE journey_runs SET status = 'done', pending = '[]'::jsonb, updated_at = NOW() WHERE id = $1`, [runId]);
      return;
    }

    const action = pending.shift();
    if (!action || typeof action !== 'object') continue;

    if (action.type === 'wait') {
      seq += 1;
      await pool.query(
        `UPDATE journey_runs SET status = 'waiting', pending = $2::jsonb, wait_seq = $3, updated_at = NOW() WHERE id = $1`,
        [runId, JSON.stringify(pending), seq]
      );
      await enqueueJourneyResume({ runId, seq, delayMs: waitMs(action.config) });
      return;
    }

    if (action.type === 'wait_event') {
      seq += 1;
      const event = action.config?.event === 'clicked' ? 'clicked' : 'replied';
      const timeoutMs = waitMs({ days: Number(action.config?.timeout_days || 1) });
      await pool.query(
        `UPDATE journey_runs SET status = 'waiting_event', wait_event = $2, wait_action = $3::jsonb,
            pending = $4::jsonb, wait_seq = $5, expires_at = NOW() + ($6 || ' milliseconds')::interval, updated_at = NOW()
          WHERE id = $1`,
        [runId, event, JSON.stringify(action), JSON.stringify(pending), seq, String(timeoutMs)]
      );
      await enqueueJourneyResume({ runId, seq, delayMs: timeoutMs, timeout: true });
      return;
    }

    if (action.type === 'branch') {
      const cases = Array.isArray(action.config?.cases) ? action.config.cases : [];
      const matched = cases.find((c) => matchesCondition(contact, c));
      const chosen = matched ? matched.actions : action.config?.default;
      pending = [...(Array.isArray(chosen) ? chosen : []), ...pending];
      continue;
    }

    // Leaf action → existing worker (immediate; waits are handled here).
    await enqueueAutomationStep({
      accountID,
      data: { automationId: run.automation_id, action, contact },
      delayMs: 0,
    });
  }

  // Guard tripped — stop the run defensively.
  await pool.query(`UPDATE journey_runs SET status = 'done', updated_at = NOW() WHERE id = $1`, [runId]);
}

// resume is fired by a delayed job: either a plain wait elapsed, or a response
// wait timed out. `seq` must still match (else an event already resumed it).
async function resume(runId, seq, timeout) {
  const run = await loadRun(runId);
  if (!run || run.status === 'done') return;
  if (Number(run.wait_seq) !== Number(seq)) return; // stale

  if (run.status === 'waiting_event' && timeout) {
    const onTimeout = (run.wait_action && run.wait_action.config && run.wait_action.config.on_timeout) || [];
    const pending = [...onTimeout, ...(run.pending || [])];
    await pool.query(
      `UPDATE journey_runs SET status = 'active', pending = $2::jsonb, wait_event = NULL, wait_action = NULL, expires_at = NULL, updated_at = NOW() WHERE id = $1`,
      [runId, JSON.stringify(pending)]
    );
  } else if (run.status === 'waiting') {
    await pool.query(`UPDATE journey_runs SET status = 'active', updated_at = NOW() WHERE id = $1`, [runId]);
  } else {
    return;
  }
  await advance(runId);
}

// handleContactEvent advances any of a contact's runs that are waiting on this
// event ('replied' | 'clicked'), running their on_event path.
async function handleContactEvent(accountID, contactId, event) {
  if (!accountID || !contactId) return;
  const { rows } = await pool.query(
    `SELECT id, wait_seq, wait_action, pending FROM journey_runs
      WHERE account_id = $1 AND contact_id = $2 AND status = 'waiting_event' AND wait_event = $3`,
    [accountID, contactId, event]
  );
  for (const run of rows) {
    const onEvent = (run.wait_action && run.wait_action.config && run.wait_action.config.on_event) || [];
    const pending = [...onEvent, ...(run.pending || [])];
    const seq = Number(run.wait_seq) + 1; // bump so the pending timeout job becomes stale
    await pool.query(
      `UPDATE journey_runs SET status = 'active', pending = $2::jsonb, wait_seq = $3,
          wait_event = NULL, wait_action = NULL, expires_at = NULL, updated_at = NOW() WHERE id = $1`,
      [run.id, JSON.stringify(pending), seq]
    );
    logger.info({ accountID, contactId, event, runId: run.id }, 'journey resumed by contact event');
    await advance(run.id);
  }
}

module.exports = { startRun, advance, resume, handleContactEvent };
