import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

// useAssist sends the conversation to the AI assistant. The backend runs Claude
// with tools (create automation/campaign/form, read pipeline/contacts) using the
// account's own Anthropic key, and returns { reply, created }.
export function useAssist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messages) => api.post('/ai/assist', { messages }).then(unwrap),
    onSuccess: (res) => {
      // Refresh lists so anything the assistant created shows up immediately.
      if (Array.isArray(res?.created) && res.created.length) {
        qc.invalidateQueries({ queryKey: ['automations'] });
        qc.invalidateQueries({ queryKey: ['campaigns'] });
        qc.invalidateQueries({ queryKey: ['forms'] });
      }
    },
  });
}
