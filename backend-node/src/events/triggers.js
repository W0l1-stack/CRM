const { subscriber } = require('../redis/client');
const { runTrigger } = require('../automation/engine');
const logger = require('../logger');

const TRIGGER_CHANNEL = 'lydia:triggers';

// startTriggerConsumer listens on the global automation trigger channel (the Go
// API publishes here on domain events) and runs the automation engine for each.
// Reuses the subscriber connection, which also pattern-subscribes to UI events.
function startTriggerConsumer() {
  subscriber.subscribe(TRIGGER_CHANNEL, (err) => {
    if (err) {
      logger.error({ err: err.message }, 'trigger subscribe failed');
      return;
    }
    logger.info('subscribed to automation triggers');
  });

  subscriber.on('message', async (channel, message) => {
    if (channel !== TRIGGER_CHANNEL) return;
    try {
      const { account_id: accountID, trigger_type: triggerType, payload } = JSON.parse(message);
      await runTrigger({ accountID, triggerType, payload });
    } catch (err) {
      logger.error({ err: err.message }, 'trigger handling failed');
    }
  });
}

module.exports = { startTriggerConsumer, TRIGGER_CHANNEL };
