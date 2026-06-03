import { useMe } from '@/hooks/useSettings';

/**
 * Role helpers mirrored from the Go middleware so the UI can hide actions the
 * server would reject anyway. The server remains the source of truth.
 *   owner  → everything (incl. billing)
 *   admin  → everything except billing
 *   member → read + send messages/notes; cannot delete
 */
export function usePermissions() {
  const { data: me } = useMe();
  const role = me?.role || 'member';
  const isOwner = role === 'owner';
  const isManager = role === 'owner' || role === 'admin';
  return {
    role,
    isOwner,
    isManager,
    canDelete: isManager,
    canManageBilling: isOwner,
    canManageTeam: isManager,
  };
}
