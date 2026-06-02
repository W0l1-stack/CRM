const { Queue } = require('bullmq');
const { createBullConnection } = require('../redis/client');

const smsQueue = new Queue('sms', { connection: createBullConnection() });

// enqueueSms schedules an sms:send job.
async function enqueueSms({ accountID, data, delayMs = 0 }) {
  return smsQueue.add(
    'sms:send',
    { accountID, data, retryCount: 0 },
    { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 }
  );
}

module.exports = { smsQueue, enqueueSms };
