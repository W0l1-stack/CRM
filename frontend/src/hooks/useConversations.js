import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { toast } from '@/store/toast.store';
import { apiErrorMessage } from '@/hooks/useAuth';

export function useConversations(status = '') {
  return useQuery({
    queryKey: ['conversations', { status }],
    queryFn: () =>
      api.get('/conversations', { params: { status: status || undefined } }).then(unwrap),
  });
}

export function useMessages(conversationId) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => api.get(`/conversations/${conversationId}/messages`).then(unwrap),
    enabled: Boolean(conversationId),
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, ...body }) =>
      api.post(`/conversations/${conversationId}/messages`, body).then(unwrap),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['messages', vars.conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(vars.channel === 'note' ? 'Note added' : `${vars.channel === 'sms' ? 'SMS' : 'Email'} sent`);
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not send message')),
  });
}

/**
 * Quick compose from a contact record: opens a conversation on the chosen
 * channel and posts the first outbound message (email/SMS are queued for
 * delivery by the Node workers; notes are recorded only).
 */
export function useComposeToContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, channel, content, subject }) => {
      const conv = await api
        .post('/conversations', { contact_id: contactId, channel, subject: subject || null })
        .then(unwrap);
      await api
        .post(`/conversations/${conv.id}/messages`, { channel, direction: 'outbound', content })
        .then(unwrap);
      return conv;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['contact-timeline', vars.contactId] });
      toast.success(vars.channel === 'note' ? 'Note added' : `${vars.channel === 'sms' ? 'SMS' : 'Email'} sent`);
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not send message')),
  });
}

export function useUpdateConversationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => api.put(`/conversations/${id}/status`, { status }).then(unwrap),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success(`Marked ${vars.status}`);
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not update conversation')),
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/conversations/${id}`).then(unwrap),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversation deleted');
    },
    onError: (e) => toast.error(apiErrorMessage(e, 'Could not delete conversation')),
  });
}
