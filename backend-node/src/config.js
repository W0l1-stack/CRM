require('dotenv').config();

// Central config read from the environment. See .env.example.
const config = {
  port: process.env.PORT || 3002,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET,
  // Dedicated key for decrypting account integration credentials. Falls back to
  // JWT_SECRET so existing creds keep decrypting. Must match the Go service.
  integrationsEncKey: process.env.INTEGRATIONS_ENC_KEY || process.env.JWT_SECRET,
  resendApiKey: process.env.RESEND_API_KEY,
  resendFrom: process.env.RESEND_FROM || 'onboarding@resend.dev',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
  },
  // Public base URL of this service, used for Twilio signature validation.
  publicUrl: process.env.PUBLIC_URL || '',
  // Error tracking (optional). When set, @sentry/node is initialized.
  sentryDsn: process.env.SENTRY_DSN || '',
};

if (!config.databaseUrl) throw new Error('config: DATABASE_URL is required');
if (!config.jwtSecret) throw new Error('config: JWT_SECRET is required');

module.exports = config;
