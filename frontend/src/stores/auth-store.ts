import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AuthUser } from '@/types/auth';
import { isStoreAccessToken } from '@/lib/store-auth';
import { useBranchStore } from '@/stores/branch-store';

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  setSession: (accessToken: string, user: AuthUser) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setSession: (accessToken, user) => {
        if (!isStoreAccessToken(accessToken)) {
          set({ accessToken: null, user: null });
          return;
        }
        set({ accessToken: accessToken.trim(), user });
      },
      clearAuth: () => {
        useBranchStore.getState().clearBranches();
        set({ accessToken: null, user: null });
      },
    }),
    {
      name: 'pos-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
      }),
    },
  ),
);

useAuthStore.persist.onFinishHydration(() => {
  const { accessToken, clearAuth } = useAuthStore.getState();
  if (accessToken && !isStoreAccessToken(accessToken)) {
    clearAuth();
  }
});
