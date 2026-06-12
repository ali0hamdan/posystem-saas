import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AuthUser } from '@/types/auth';
import { isStoreAccessToken } from '@/lib/store-auth';
import { useBranchStore } from '@/stores/branch-store';

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  permissions: string[];
  setSession: (accessToken: string, user: AuthUser, permissions?: string[]) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      permissions: [],
      setSession: (accessToken, user, permissions = []) => {
        if (!isStoreAccessToken(accessToken)) {
          set({ accessToken: null, user: null, permissions: [] });
          return;
        }
        set({ accessToken: accessToken.trim(), user, permissions });
      },
      clearAuth: () => {
        useBranchStore.getState().clearBranches();
        set({ accessToken: null, user: null, permissions: [] });
      },
    }),
    {
      name: 'pos-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        permissions: state.permissions,
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
