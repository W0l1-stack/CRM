const { Worker } = require('bullmq');
const { createBullConnection } = require('../redis/client');
const logger = require('../logger');
const pool = require('../db');
const { publishEvent } = require('../events/publisher');
const { getAccountIntegration } = require('../providers/account');
const { sendSms } = require('../providers/sms');

// startSmsWorker consumes sms:send jobs and sends via the account's own SMS
// provider (or the server fallback), then updates the message row and notifies
// the account room.
function startSmsWorker() {
  const worker = new Worker(
    'sms',
    async (job) => {
      const { accountID, data } = job.data;
      logger.info({ jobId: job.id, accountID }, 'sms:send start');

      const { to, body, messageId } = data;
      const integration = await getAccountIntegration(accountID, 'sms');
      const externalId = await sendSms(integration, { to, body });

      if (messageId) {
        await pool.query(
          `UPDATE messages SET status = 'sent', external_id = $1 WHERE account_id = $2 AND id = $3`,
          [externalId, accountID, messageId]
        );
        await publishEvent(accountID, 'message:updated', { id: messageId, status: 'sent', external_id: externalId });
      }

      logger.info({ jobId: job.id, accountID, externalId }, 'sms:send success');
      return { externalId };
    },
    { connection: createBullConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, accountID: job?.data?.accountID, err: err.message }, 'sms:send failed');
  });

  return worker;
}

module.exports = { startSmsWorker };
