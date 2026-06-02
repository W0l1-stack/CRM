const { subscriber } = require('../redis/client');
const logger = require('../logger');
const { enqueueCampaign } = require('../queues/campaign.queue');

const CAMPAIGN_CHANNEL = 'lydia:campaigns';

// startCampaignConsumer listens for campaign-send requests from the Go API and
// enqueues a BullMQ job (immediately, or delayed for scheduled sends). The
// campaign worker performs the actual recipient resolution + delivery.
function startCampaignConsumer() {
  subscriber.subscribe(CAMPAIGN_CHANNEL, (err) => {
    if (err) {
      logger.error({ err: err.message }, 'campaign subscribe failed');
      return;
    }
    logger.info('subscribed to campaign channel');
  });

  subscriber.on('message', async (channel, message) => {
    if (channel !== CAMPAIGN_CHANNEL) return;
    try {
      const { account_id: accountID, campaign_id: campaignId, delay_ms: delayMs } = JSON.parse(message);
      await enqueueCampaign({ accountID, campaignId, delayMs: Number(delayMs) || 0 });
      logger.info({ accountID, campaignId, delayMs }, 'campaign enqueued');
    } catch (err) {
      logger.error({ err: err.message }, 'campaign enqueue failed');
    }
  });
}

module.exports = { startCampaignConsumer };
