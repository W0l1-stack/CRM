const { Worker } = require('bullmq');
const { createBullConnection } = require('../redis/client');
const logger = require('../logger');
const { sendCampaign } = require('../campaigns/sender');

// startCampaignWorker runs campaign:send jobs (immediate or delayed/scheduled).
function startCampaignWorker() {
  const worker = new Worker(
    'campaign',
    async (job) => {
      const { accountID, data } = job.data;
      logger.info({ jobId: job.id, accountID, campaignId: data?.campaignId }, 'campaign:send start');
      await sendCampaign(accountID, data.campaignId);
      logger.info({ jobId: job.id, accountID, campaignId: data?.campaignId }, 'campaign:send success');
      return { ok: true };
    },
    { connection: createBullConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, accountID: job?.data?.accountID, err: err.message }, 'campaign:send failed');
  });

  return worker;
}

module.exports = { startCampaignWorker };
