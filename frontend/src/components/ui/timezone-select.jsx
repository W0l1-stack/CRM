import { useMemo } from 'react';
import { cn } from '@/lib/utils';

// Full IANA timezone list straight from the runtime (no hardcoding). Older
// browsers without Intl.supportedValuesOf fall back to a small common set.
function listTimezones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone');
    }
  } catch {
    /* fall through */
  }
  return [
    'UTC',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
    'Africa/Lagos', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata',
    'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
  ];
}

/** Returns the browser's best-guess timezone (for sensible defaults). */
export function guessTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * IANA timezone picker. `onChange` receives the selected zone string (not an
 * event) so callers can wire it straight into form state.
 */
export function TimezoneSelect({ value, onChange, id, className }) {
  const zones = useMemo(listTimezones, []);
  // Keep an unknown stored value selectable so we never silently drop it.
  const options = value && !zones.includes(value) ? [value, ...zones] : zones;

  return (
    <select
      id={id}
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      {!value && <option value="" disabled>Select timezone…</option>}
      {options.map((tz) => (
        <option key={tz} value={tz}>
          {tz.replace(/_/g, ' ')}
        </option>
      ))}
    </select>
  );
}
