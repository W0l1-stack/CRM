const config = require('../config');

// Each adapter sends one message and returns a provider message id (or null).
async function viaTwilio({ account_sid, auth_token }, from, to, body) {
  const auth = Buffer.from(`${account_sid}:${auth_token}`).toString('base64');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account_sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from, To: to, Body: body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`twilio: ${json.message || res.status}`);
  return json.sid || null;
}

async function viaVonage({ api_key, api_secret }, from, to, body) {
  const res = await fetch('https://rest.nexmo.com/sms/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ api_key, api_secret, from, to, text: body }),
  });
  const json = await res.json().catch(() => ({}));
  const m = json.messages && json.messages[0];
  if (!res.ok || !m || m.status !== '0') throw new Error(`vonage: ${(m && m['error-text']) || res.status}`);
  return m['message-id'] || null;
}

async function viaMessageBird({ access_key }, from, to, body) {
  const res = await fetch('https://rest.messagebird.com/messages', {
    method: 'POST',
    headers: { Authorization: `AccessKey ${access_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ originator: from, recipients: [to], body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`messagebird: ${(json.errors && json.errors[0] && json.errors[0].description) || res.status}`);
  return json.id || null;
}

// sendSms uses the account's own provider when connected, else the server Twilio
// env as a fallback. Returns the provider message id.
async function sendSms(integration, { to, body }) {
  if (integration) {
    const { provider, from, config: cfg } = integration;
    if (provider === 'twilio') return viaTwilio(cfg, from, to, body);
    if (provider === 'vonage') return viaVonage(cfg, from, to, body);
    if (provider === 'messagebird') return viaMessageBird(cfg, from, to, body);
    throw new Error(`unsupported sms provider: ${provider}`);
  }
  if (!config.twilio.accountSid || !config.twilio.authToken) {
    throw new Error('no SMS provider connected (set one in Settings → Integrations)');
  }
  return viaTwilio(
    { account_sid: config.twilio.accountSid, auth_token: config.twilio.authToken },
    config.twilio.fromNumber, to, body
  );
}

module.exports = { sendSms };
