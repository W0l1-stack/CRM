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

// runTrigger finds active automations for the trigger and enqueues their action
// steps. `wait` actions don't enqueue a job — they push subsequent steps out by
// a cumulative delay (BullMQ delayed jobs).
async function runTrigger({ accountID, triggerType, payload }) {
  if (!accountID || !triggerType) return;

  const { rows } = await pool.query(
    `SELECT id, name, actions FROM automations
      WHERE account_id = $1 AND is_active = TRUE AND $2 = ANY(trigger_types)`,
    [accountID, triggerType]
  );

  for (const auto of rows) {
    const actions = Array.isArray(auto.actions) ? auto.actions : [];
    let delayMs = 0;
    for (const action of actions) {
      if (action.type === 'wait') {
        delayMs += waitMs(action.config);
        continue;
      }
      await enqueueAutomationStep({
        accountID,
        data: { automationId: auto.id, action, contact: payload },
        delayMs,
      });
    }
    logger.info({ accountID, automationId: auto.id, triggerType, steps: actions.length }, 'automation triggered');
  }
}

module.exports = { runTrigger };
