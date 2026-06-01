const { Queue } = require('bullmq');
const { createBullConnection } = require('../redis/client');

const automationQueue = new Queue('automation', { connection: createBullConnection() });

// enqueueAutomationStep schedules a single automation:step. A `delayMs` lets the
// engine implement "wait X days" steps via BullMQ's delayed jobs.
async function enqueueAutomationStep({ accountID, data, delayMs = 0 }) {
  return automationQueue.add(
    'automation:step',
    { accountID, data, retryCount: 0 },
    { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 }
  );
}

module.exports = { automationQueue, enqueueAutomationStep };
