import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export function useContacts({ search = '', tag = '' } = {}) {
  return useQuery({
    queryKey: ['contacts', { search, tag }],
    queryFn: () =>
      api.get('/contacts', { params: { search: search || undefined, tag: tag || undefined } }).then(unwrap),
  });
}

export function useContact(id) {
  return useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get(`/contacts/${id}`).then(unwrap),
    enabled: Boolean(id),
  });
}

export function useContactTimeline(id) {
  return useQuery({
    queryKey: ['contact-timeline', id],
    queryFn: () => api.get(`/contacts/${id}/timeline`).then(unwrap),
    enabled: Boolean(id),
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post('/contacts', body).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/contacts/${id}`, body).then(unwrap),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contact', vars.id] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/contacts/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useImportContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file) => {
      const form = new FormData();
      form.append('file', file);
      return api.post('/contacts/import', form).then(unwrap);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}
