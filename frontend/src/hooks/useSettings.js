import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api.get('/me').then(unwrap) });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.put('/me', body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}

export function useAccount() {
  return useQuery({ queryKey: ['account'], queryFn: () => api.get('/account').then(unwrap) });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.put('/account', body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account'] }),
  });
}

export function useTeam() {
  return useQuery({ queryKey: ['team'], queryFn: () => api.get('/team').then(unwrap) });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/team', body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  });
}

export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }) => api.put(`/team/${id}/role`, { role }).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/team/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  });
}
