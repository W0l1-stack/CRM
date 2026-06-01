const { Pool } = require('pg');
const config = require('./config');

// Shared PostgreSQL pool. Same database the Go API owns; this service only
// reads/writes messages and conversations for the real-time + webhook flows.
// Every query here still filters by account_id.
const pool = new Pool({ connectionString: config.databaseUrl });

module.exports = pool;
