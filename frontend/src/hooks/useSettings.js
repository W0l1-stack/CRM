import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { toast } from '@/store/toast.store';
import { apiErrorMessage } from '@/hooks/useAuth';

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api.get('/me').then(unwrap) });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.put('/me', body).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile saved');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not save profile')),
  });
}

export function useAccount() {
  return useQuery({ queryKey: ['account'], queryFn: () => api.get('/account').then(unwrap) });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.put('/account', body).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['account'] });
      toast.success('Workspace saved');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not save workspace')),
  });
}

export function useTeam() {
  return useQuery({ queryKey: ['team'], queryFn: () => api.get('/team').then(unwrap) });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/team', body).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success('Invitation created');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not invite member')),
  });
}

export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }) => api.put(`/team/${id}/role`, { role }).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success('Role updated');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not change role')),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/team/${id}`).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success('Member removed');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not remove member')),
  });
}
