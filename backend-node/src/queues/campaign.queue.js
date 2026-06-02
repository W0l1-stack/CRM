const { Queue } = require('bullmq');
const { createBullConnection } = require('../redis/client');

const campaignQueue = new Queue('campaign', { connection: createBullConnection() });

// enqueueCampaign schedules a campaign:send job. delayMs > 0 defers it (used
// for scheduled campaigns).
async function enqueueCampaign({ accountID, campaignId, delayMs = 0 }) {
  return campaignQueue.add(
    'campaign:send',
    { accountID, data: { campaignId }, retryCount: 0 },
    { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 10000 }, removeOnComplete: 500, removeOnFail: 1000 }
  );
}

module.exports = { campaignQueue, enqueueCampaign };
