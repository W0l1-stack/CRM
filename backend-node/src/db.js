const { Pool } = require('pg');
const config = require('./config');

// Managed Postgres (e.g. Supabase) requires TLS. When the URL asks for SSL we
// enable it without strict CA verification (the pooler presents its own cert),
// matching `sslmode=require` semantics.
const needsSsl = /sslmode=require/i.test(config.databaseUrl || '') || /supabase\.com/i.test(config.databaseUrl || '');

// Shared PostgreSQL pool. Same database the Go API owns; this service only
// reads/writes messages and conversations for the real-time + webhook flows.
// Every query here still filters by account_id.
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

module.exports = pool;
