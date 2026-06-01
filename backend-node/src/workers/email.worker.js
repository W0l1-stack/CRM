const { Worker } = require('bullmq');
const { Resend } = require('resend');
const { createBullConnection } = require('../redis/client');
const config = require('../config');
const logger = require('../logger');
const pool = require('../db');
const { publishEvent } = require('../events/publisher');

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

// startEmailWorker consumes email:send jobs and sends via Resend, then updates
// the message row and notifies the account room.
function startEmailWorker() {
  const worker = new Worker(
    'email',
    async (job) => {
      const { accountID, data } = job.data;
      logger.info({ jobId: job.id, accountID }, 'email:send start');

      if (!resend) throw new Error('RESEND_API_KEY not configured');

      const { to, subject, html, messageId } = data;
      const result = await resend.emails.send({ from: config.resendFrom, to, subject, html });
      const externalId = result?.data?.id || null;

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
