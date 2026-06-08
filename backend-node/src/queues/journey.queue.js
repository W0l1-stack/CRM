const { Queue } = require('bullmq');
const { createBullConnection } = require('../redis/client');

const journeyQueue = new Queue('journey', { connection: createBullConnection() });

// enqueueJourneyResume schedules a delayed resume of a paused journey run. `seq`
// guards against a stale timeout firing after the run was already resumed by an
// event; `timeout` marks a response wait that expired.
async function enqueueJourneyResume({ runId, seq, delayMs = 0, timeout = false }) {
  return journeyQueue.add(
    'journey:resume',
    { runId, seq, timeout },
    { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000, removeOnFail: 5000 }
  );
}

module.exports = { journeyQueue, enqueueJourneyResume };
