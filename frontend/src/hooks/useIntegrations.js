import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

/**
 * Real connection state for the platform integrations (email/Resend, SMS/Twilio,
 * Google Calendar) so the Settings page can show "Connected / Not connected"
 * instead of a hardcoded badge.
 */
export function useIntegrationsStatus() {
  return useQuery({
    queryKey: ['integrations-status'],
    queryFn: () => api.get('/integrations/status').then(unwrap),
    staleTime: 60_000,
  });
}
