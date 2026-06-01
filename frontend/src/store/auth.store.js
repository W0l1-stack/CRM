import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Auth state for the logged-in user and their tokens. Persisted to
 * localStorage so a refresh keeps the session. The API client (lib/api.js)
 * reads/writes tokens here via getState/setState.
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      // setSession stores the result of login/register/refresh.
      setSession: ({ user, tokens }) =>
        set((prev) => ({
          user: user ?? prev.user,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        })),

      setAccessToken: (accessToken) => set({ accessToken }),

      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'lydia-auth' }
  )
);

export const isAuthenticated = () => Boolean(useAuthStore.getState().accessToken);
