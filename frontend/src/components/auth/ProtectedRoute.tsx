import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useAuthHydrated } from '@/hooks/use-auth-hydrated';
import { isStoreAccessToken } from '@/lib/store-auth';
import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const hydrated = useAuthHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();

  if (!hydrated) {
    return <AuthLoadingScreen message="Starting app…" />;
  }

  if (!isStoreAccessToken(accessToken)) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}
