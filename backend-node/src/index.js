const http = require('http');
const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');

const config = require('./config');
const logger = require('./logger');
const { initSocket } = require('./socket/server');
const { startEventSubscriber } = require('./events/subscriber');
const { startEmailWorker } = require('./workers/email.worker');
const { startSmsWorker } = require('./workers/sms.worker');
const { startAutomationWorker } = require('./workers/automation.worker');
const twilioWebhook = require('./webhooks/twilio');
const resendWebhook = require('./webhooks/resend');

const app = express();
app.use(cors());
app.use(pinoHttp({ logger }));

app.get('/health', (_req, res) => res.json({ data: { status: 'ok' }, error: null, meta: null }));

// Inbound webhooks (each route parses its own body type).
app.use('/webhooks', twilioWebhook);
app.use('/webhooks', resendWebhook);

const server = http.createServer(app);

// Real-time: Socket.io with JWT auth + per-account rooms.
initSocket(server);

// Bridge Redis account event channels -> Socket.io rooms.
startEventSubscriber();

// BullMQ workers (email, SMS, automation steps).
const workers = [startEmailWorker(), startSmsWorker(), startAutomationWorker()];

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
