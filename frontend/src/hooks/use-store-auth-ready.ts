import { useAuthHydrated } from '@/hooks/use-auth-hydrated';
import { isStoreAccessToken } from '@/lib/store-auth';
import { useAuthStore } from '@/stores/auth-store';

/** Store session is hydrated and has a valid client user JWT + profile. */
export function useStoreAuthReady(): boolean {
  const hydrated = useAuthHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  return hydrated && isStoreAccessToken(accessToken) && Boolean(user?.id);
}
