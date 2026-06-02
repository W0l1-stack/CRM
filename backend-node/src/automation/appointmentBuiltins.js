const logger = require('../logger');
const { enqueueEmail } = require('../queues/email.queue');
const { enqueueSms } = require('../queues/sms.queue');

const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000; // 24h before

function formatWhen(iso) {
  try {
    return new Date(iso).toUTCString();
  } catch {
    return iso;
  }
}

// Send via email when available, otherwise fall back to SMS.
async function notify({ accountID, contact, subject, text, delayMs = 0 }) {
  if (contact.email) {
    await enqueueEmail({
      accountID,
      delayMs,
      data: { to: contact.email, subject, html: `<p>${text}</p>` },
    });
    return 'email';
  }
  if (contact.phone) {
    await enqueueSms({ accountID, delayMs, data: { to: contact.phone, body: text } });
    return 'sms';
  }
  return 'none';
}

// handleAppointmentBooked sends a confirmation now and schedules a reminder
// ~24h before the appointment. Built-in behaviour, independent of any
// user-defined automation on the appointment_booked trigger.
async function handleAppointmentBooked(accountID, payload) {
  const appt = payload?.appointment;
  const contact = payload?.contact;
  if (!appt || !contact || (!contact.email && !contact.phone)) return;

  const when = formatWhen(appt.starts_at);
  const name = contact.name || 'there';

  const channel = await notify({
    accountID,
    contact,
    subject: 'Your appointment is confirmed',
    text: `Hi ${name}, your appointment is confirmed for ${when}.`,
  });

  // Reminder, 24h before (only if that's still in the future).
  const startsMs = new Date(appt.starts_at).getTime();
  const delayMs = startsMs - REMINDER_LEAD_MS - Date.now();
  if (Number.isFinite(delayMs) && delayMs > 0) {
    await notify({
      accountID,
      contact,
      subject: 'Reminder: your appointment is tomorrow',
      text: `Hi ${name}, this is a reminder for your appointment on ${when}.`,
      delayMs,
    });
  }

  logger.info({ accountID, startsAt: appt.starts_at, channel, reminderInMs: delayMs }, 'appointment confirmation + reminder scheduled');
}

module.exports = { handleAppointmentBooked };
