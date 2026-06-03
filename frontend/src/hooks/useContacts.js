import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { toast } from '@/store/toast.store';
import { apiErrorMessage } from '@/hooks/useAuth';

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact created');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not create contact')),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => api.put(`/contacts/${id}`, body).then(unwrap),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['contact', vars.id] });
      toast.success('Contact updated');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not update contact')),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/contacts/${id}`).then(unwrap),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not delete contact')),
  });
}

/** Adds a tag to many contacts at once (one PUT each), with a single toast. */
export function useBulkTagContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contacts, tag }) =>
      Promise.all(
        contacts.map((c) => {
          const tags = Array.from(new Set([...(c.tags || []), tag]));
          return api.put(`/contacts/${c.id}`, { ...c, tags });
        })
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Tagged ${vars.contacts.length} contact(s) “${vars.tag}”`);
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Bulk tag failed')),
  });
}

/**
 * Deletes many contacts at once. Used behind the undo flow on the Contacts
 * page — the toast is fired by the caller, so this stays quiet on success.
 */
export function useBulkDeleteContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => api.delete(`/contacts/${id}`))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
    onError: (e) => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.error(apiErrorMessage(e, 'Bulk delete failed'));
    },
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
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Imported ${data.created} contact(s)${data.failed ? `, ${data.failed} failed` : ''}`);
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Import failed')),
  });
}
