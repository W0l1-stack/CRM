const IORedis = require('ioredis');
const config = require('../config');
const logger = require('./../logger');

/**
 * Redis connections. We keep dedicated connections per role because a
 * connection in "subscriber" mode cannot issue normal commands, and BullMQ
 * requires maxRetriesPerRequest = null on its connection.
 */

function attachErrorLogging(conn, role) {
  // Without an 'error' listener ioredis logs noisy "Unhandled error event"s.
  conn.on('error', (err) => logger.warn({ role, err: err.message }, 'redis connection error'));
  return conn;
}

// General-purpose connection for publishing events and ad-hoc commands.
const redis = attachErrorLogging(new IORedis(config.redisUrl, { maxRetriesPerRequest: null }), 'main');

// Dedicated subscriber connection (pattern-subscribes to account event channels).
const subscriber = attachErrorLogging(new IORedis(config.redisUrl, { maxRetriesPerRequest: null }), 'subscriber');

// BullMQ wants its own connection with retries disabled.
function createBullConnection() {
  return attachErrorLogging(new IORedis(config.redisUrl, { maxRetriesPerRequest: null }), 'bullmq');
}

module.exports = { redis, subscriber, createBullConnection };
