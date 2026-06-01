const { Worker } = require('bullmq');
const { createBullConnection } = require('../redis/client');
const logger = require('../logger');

/**
 * startAutomationWorker consumes automation:step jobs. The full automation
 * engine (triggers, branching, wait steps) lands in Week 7-8; this worker is
 * the execution surface it will enqueue onto. For now it logs each step and
 * acknowledges, so the queue and wiring are exercised end to end.
 */
function startAutomationWorker() {
  const worker = new Worker(
    'automation',
    async (job) => {
      const { accountID, data } = job.data;
      logger.info({ jobId: job.id, accountID, action: data?.action }, 'automation:step start');
      // Placeholder: real step execution (send email/sms, add tag, move deal)
      // will dispatch to the email/sms queues here.
      logger.info({ jobId: job.id, accountID }, 'automation:step success');
      return { ok: true };
    },
    { connection: createBullConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, accountID: job?.data?.accountID, err: err.message }, 'automation:step failed');
  });

  return worker;
}

module.exports = { startAutomationWorker };
