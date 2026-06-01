const pino = require('pino');

// Structured logger shared across the service (CLAUDE.md: pino in Node).
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'lydia-node' },
});

module.exports = logger;
