import { useMutation } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (body) => api.post('/auth/login', body).then(unwrap),
    onSuccess: (result) => setSession(result),
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (body) => api.post('/auth/register', body).then(unwrap),
    onSuccess: (result) => setSession(result),
  });
}

/** Extracts a human-readable message from an API error envelope. */
export function apiErrorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.error?.message || fallback;
}
