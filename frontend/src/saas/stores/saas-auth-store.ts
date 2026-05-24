import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { isSaasAccessToken } from '@/lib/saas-auth';
import type { SaasAdmin } from '@/saas/types';

type SaasAuthState = {
  accessToken: string | null;
  admin: SaasAdmin | null;
  setSession: (accessToken: string, admin: SaasAdmin) => void;
  clearAuth: () => void;
};

export const useSaasAuthStore = create<SaasAuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      admin: null,
      setSession: (accessToken, admin) => {
        if (!isSaasAccessToken(accessToken)) {
          set({ accessToken: null, admin: null });
          return;
        }
        set({ accessToken: accessToken.trim(), admin });
      },
      clearAuth: () => set({ accessToken: null, admin: null }),
    }),
    {
      name: 'saas-auth',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

useSaasAuthStore.persist.onFinishHydration(() => {
  const { accessToken, clearAuth } = useSaasAuthStore.getState();
  if (accessToken && !isSaasAccessToken(accessToken)) {
    clearAuth();
  }
});
