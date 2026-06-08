const { Worker } = require('bullmq');
const { createBullConnection } = require('../redis/client');
const logger = require('../logger');
const pool = require('../db');
const { publishEvent } = require('../events/publisher');
const { getAccountIntegration } = require('../providers/account');
const { sendEmail } = require('../providers/email');

// startEmailWorker consumes email:send jobs and sends via the account's own
// email provider (or the server fallback), then updates the message row and
// notifies the account room.
function startEmailWorker() {
  const worker = new Worker(
    'email',
    async (job) => {
      const { accountID, data } = job.data;
      logger.info({ jobId: job.id, accountID }, 'email:send start');

      const { to, subject, html, messageId, tags } = data;
      const integration = await getAccountIntegration(accountID, 'email');
      const externalId = await sendEmail(integration, { to, subject, html, tags });

      if (messageId) {
        await pool.query(
          `UPDATE messages SET status = 'sent', external_id = $1 WHERE account_id = $2 AND id = $3`,
          [externalId, accountID, messageId]
        );
        await publishEvent(accountID, 'message:updated', { id: messageId, status: 'sent', external_id: externalId });
      }

      logger.info({ jobId: job.id, accountID, externalId }, 'email:send success');
      return { externalId };
    },
    { connection: createBullConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, accountID: job?.data?.accountID, err: err.message }, 'email:send failed');
  });

  return worker;
}

module.exports = { startEmailWorker };
