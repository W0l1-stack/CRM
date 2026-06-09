const crypto = require('crypto');
const config = require('./config');

// Mirrors the Go crypto package: AES-256-GCM, key = sha256(INTEGRATIONS_ENC_KEY),
// payload = base64(nonce[12] || ciphertext || tag[16]).
function key() {
  return crypto.createHash('sha256').update(String(config.integrationsEncKey)).digest();
}

function decrypt(encoded) {
  const raw = Buffer.from(encoded, 'base64');
  const nonce = raw.subarray(0, 12);
  const tag = raw.subarray(raw.length - 16);
  const ciphertext = raw.subarray(12, raw.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { decrypt };
