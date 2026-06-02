import { useQuery, useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';

export function useBillingStatus() {
  return useQuery({
    queryKey: ['billing'],
    queryFn: () => api.get('/billing').then(unwrap),
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (plan) => api.post('/billing/checkout', { plan }).then(unwrap),
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
  });
}

export function usePortal() {
  return useMutation({
    mutationFn: () => api.post('/billing/portal').then(unwrap),
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
  });
}
