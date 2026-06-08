const pool = require('../db');
const logger = require('../logger');
const { decrypt } = require('../crypto');

// getAccountIntegration loads an account's own provider for a kind ('sms' |
// 'email') and decrypts its credentials. Returns null when the account hasn't
// connected its own provider (callers then fall back to the server env), and is
// resilient to the table not existing yet (pre-migration).
async function getAccountIntegration(accountID, kind) {
  if (!accountID) return null;
  try {
    const { rows } = await pool.query(
      `SELECT provider, config_enc, from_value FROM account_integrations
        WHERE account_id = $1 AND kind = $2 AND is_active = TRUE LIMIT 1`,
      [accountID, kind]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    let config;
    try {
      config = JSON.parse(decrypt(row.config_enc));
    } catch (err) {
      logger.error({ accountID, kind, err: err.message }, 'integration decrypt failed');
      return null;
    }
    return { provider: row.provider, from: row.from_value, config };
  } catch (err) {
    return null;
  }
}

module.exports = { getAccountIntegration };
