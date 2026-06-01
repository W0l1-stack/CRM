import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

const baseURL = import.meta.env.VITE_API_URL || '/api/v1';

// Single axios instance. Every API call in the app goes through here.
export const api = axios.create({ baseURL });

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, try a one-time refresh, then replay the original request.
let refreshing = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (status !== 401 || original?._retried) {
      return Promise.reject(error);
    }

    const { refreshToken, setSession, logout } = useAuthStore.getState();
    if (!refreshToken) {
      logout();
      return Promise.reject(error);
    }

    try {
      // Coalesce concurrent refreshes into a single request.
      refreshing =
        refreshing ||
        axios
          .post(`${baseURL}/auth/refresh`, { refresh_token: refreshToken })
          .then((res) => res.data.data);

      const result = await refreshing;
      refreshing = null;
      setSession(result);

      original._retried = true;
      original.headers.Authorization = `Bearer ${result.tokens.access_token}`;
      return api(original);
    } catch (refreshError) {
      refreshing = null;
      logout();
      return Promise.reject(refreshError);
    }
  }
);

/** unwrap returns the payload from the standard {data, error, meta} envelope. */
export const unwrap = (response) => response.data.data;
