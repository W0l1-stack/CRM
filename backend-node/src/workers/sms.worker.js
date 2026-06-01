const { Worker } = require('bullmq');
const twilio = require('twilio');
const { createBullConnection } = require('../redis/client');
const config = require('../config');
const logger = require('../logger');
const pool = require('../db');
const { publishEvent } = require('../events/publisher');

const client =
  config.twilio.accountSid && config.twilio.authToken
    ? twilio(config.twilio.accountSid, config.twilio.authToken)
    : null;

// startSmsWorker consumes sms:send jobs and sends via Twilio, then updates the
// message row and notifies the account room.
function startSmsWorker() {
  const worker = new Worker(
    'sms',
    async (job) => {
      const { accountID, data } = job.data;
      logger.info({ jobId: job.id, accountID }, 'sms:send start');

      if (!client) throw new Error('Twilio credentials not configured');

      const { to, body, messageId } = data;
      const sent = await client.messages.create({ from: config.twilio.fromNumber, to, body });
      const externalId = sent.sid;

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
