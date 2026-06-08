const { Worker } = require('bullmq');
const { createBullConnection } = require('../redis/client');
const logger = require('../logger');
const { resume } = require('../automation/journey');

// startJourneyWorker resumes paused journey runs when a wait elapses or a
// response wait times out.
function startJourneyWorker() {
  const worker = new Worker(
    'journey',
    async (job) => {
      const { runId, seq, timeout } = job.data;
      await resume(runId, seq, Boolean(timeout));
      return { ok: true };
    },
    { connection: createBullConnection() }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, runId: job?.data?.runId, err: err.message }, 'journey:resume failed');
  });

  return worker;
}

module.exports = { startJourneyWorker };
