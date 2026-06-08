const config = require('../config');
const { Resend } = require('resend');

async function viaResend({ api_key }, from, { to, subject, html, tags }) {
  const resend = new Resend(api_key);
  const payload = { from, to, subject, html };
  if (Array.isArray(tags) && tags.length) payload.tags = tags;
  const result = await resend.emails.send(payload);
  if (result.error) throw new Error(`resend: ${result.error.message || 'send failed'}`);
  return result?.data?.id || null;
}

async function viaSendgrid({ api_key }, from, { to, subject, html }) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`sendgrid: ${res.status} ${t}`);
  }
  return res.headers.get('x-message-id') || null;
}

async function viaMailgun({ api_key, domain }, from, { to, subject, html }) {
  const auth = Buffer.from(`api:${api_key}`).toString('base64');
  const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ from, to, subject, html }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`mailgun: ${json.message || res.status}`);
  return json.id || null;
}

// sendEmail uses the account's own provider when connected, else the server
// Resend env as a fallback. Returns the provider message id.
async function sendEmail(integration, payload) {
  if (integration) {
    const { provider, from, config: cfg } = integration;
    if (provider === 'resend') return viaResend(cfg, from, payload);
    if (provider === 'sendgrid') return viaSendgrid(cfg, from, payload);
    if (provider === 'mailgun') return viaMailgun(cfg, from, payload);
    throw new Error(`unsupported email provider: ${provider}`);
  }
  if (!config.resendApiKey) {
    throw new Error('no email provider connected (set one in Settings → Integrations)');
  }
  return viaResend({ api_key: config.resendApiKey }, config.resendFrom, payload);
}

module.exports = { sendEmail };
