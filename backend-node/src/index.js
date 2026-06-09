const http = require('http');
const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');

const config = require('./config');
const logger = require('./logger');
const { initSocket } = require('./socket/server');
const { startEventSubscriber } = require('./events/subscriber');
const { startTriggerConsumer } = require('./events/triggers');
const { startOutboundConsumer } = require('./events/outbound');
const { startCampaignConsumer } = require('./events/campaigns');
const { startEmailWorker } = require('./workers/email.worker');
const { startSmsWorker } = require('./workers/sms.worker');
const { startAutomationWorker } = require('./workers/automation.worker');
const { startCampaignWorker } = require('./workers/campaign.worker');
const { startJourneyWorker } = require('./workers/journey.worker');
const twilioWebhook = require('./webhooks/twilio');
const resendWebhook = require('./webhooks/resend');

// Error tracking (optional — only when SENTRY_DSN is set). Lazy-required so the
// service runs locally without the dependency installed.
let Sentry = null;
if (config.sentryDsn) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({ dsn: config.sentryDsn });
    logger.info('sentry initialized');
  } catch (err) {
    logger.error({ err }, 'sentry init failed (is @sentry/node installed?)');
    Sentry = null;
  }
}
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'unhandledRejection');
  if (Sentry) Sentry.captureException(reason);
});

const app = express();
app.use(cors());
app.use(pinoHttp({ logger }));

app.get('/health', (_req, res) => res.json({ data: { status: 'ok' }, error: null, meta: null }));

// Inbound webhooks (each route parses its own body type).
app.use('/webhooks', twilioWebhook);
app.use('/webhooks', resendWebhook);

// Sentry's Express error handler (captures with request context) sits before
// our own 500 responder so it isn't double-reported.
if (Sentry) Sentry.setupExpressErrorHandler(app);
app.use((err, _req, res, _next) => {
  logger.error({ err }, 'unhandled request error');
  res.status(500).json({ data: null, error: 'internal error', meta: null });
});

const server = http.createServer(app);

// Real-time: Socket.io with JWT auth + per-account rooms.
initSocket(server);

// Bridge Redis account event channels -> Socket.io rooms.
startEventSubscriber();

// Run automations off the Go API's trigger channel.
startTriggerConsumer();

// Send outbound messages requested by the Go API.
startOutboundConsumer();

// Send campaigns requested by the Go API.
startCampaignConsumer();

// BullMQ workers (email, SMS, automation steps).
const workers = [startEmailWorker(), startSmsWorker(), startAutomationWorker(), startCampaignWorker(), startJourneyWorker()];

// BullMQ failures surface as 'failed' events (not Express / unhandledRejection),
// so report background job failures to Sentry centrally.
if (Sentry) {
  workers.forEach((w) => w.on('failed', (_job, err) => Sentry.captureException(err)));
}

server.listen(config.port, () => {
  logger.info({ port: config.port }, 'Lydia Node real-time service listening');
});

// Graceful shutdown.
async function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  await Promise.allSettled(workers.map((w) => w.close()));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server };
