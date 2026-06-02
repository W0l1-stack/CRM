const { Queue } = require('bullmq');
const { createBullConnection } = require('../redis/client');

const emailQueue = new Queue('email', { connection: createBullConnection() });

// enqueueEmail schedules an email:send job. Payloads carry accountID, the data
// needed to render/send, and a retryCount — never secrets (workers read those
// from env).
async function enqueueEmail({ accountID, data, delayMs = 0 }) {
  return emailQueue.add(
    'email:send',
    { accountID, data, retryCount: 0 },
    { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 }
  );
}

module.exports = { emailQueue, enqueueEmail };
