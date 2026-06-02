const logger = require('../logger');
const { enqueueEmail } = require('../queues/email.queue');

const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000; // 24h before

function formatWhen(iso) {
  try {
    return new Date(iso).toUTCString();
  } catch {
    return iso;
  }
}

// handleAppointmentBooked sends a confirmation now and schedules a reminder
// ~24h before the appointment. This is built-in behaviour, independent of any
// user-defined automation on the appointment_booked trigger.
async function handleAppointmentBooked(accountID, payload) {
  const appt = payload?.appointment;
  const contact = payload?.contact;
  if (!appt || !contact?.email) return;

  const when = formatWhen(appt.starts_at);

  // Confirmation, immediately.
  await enqueueEmail({
    accountID,
    data: {
      to: contact.email,
      subject: 'Your appointment is confirmed',
      html: `<p>Hi ${contact.name || 'there'},</p><p>Your appointment is confirmed for <strong>${when}</strong>.</p>`,
    },
  });

  // Reminder, 24h before (only if that's still in the future).
  const startsMs = new Date(appt.starts_at).getTime();
  const delayMs = startsMs - REMINDER_LEAD_MS - Date.now();
  if (Number.isFinite(delayMs) && delayMs > 0) {
    await enqueueEmail({
      accountID,
      delayMs,
      data: {
        to: contact.email,
        subject: 'Reminder: your appointment is tomorrow',
        html: `<p>Hi ${contact.name || 'there'},</p><p>This is a reminder for your appointment on <strong>${when}</strong>.</p>`,
      },
    });
  }

  logger.info({ accountID, startsAt: appt.starts_at, reminderInMs: delayMs }, 'appointment confirmation + reminder scheduled');
}

module.exports = { handleAppointmentBooked };
