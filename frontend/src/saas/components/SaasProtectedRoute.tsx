import { Navigate, useLocation } from 'react-router-dom';
import { isSaasAccessToken } from '@/lib/saas-auth';
import { useSaasAuthStore } from '@/saas/stores/saas-auth-store';
import { useSaasAuthHydrated } from '@/saas/hooks/use-saas-auth-hydrated';
import { saasPath } from '@/saas/config/saas-paths';

export function SaasProtectedRoute({ children }: { children: React.ReactNode }) {
  const hydrated = useSaasAuthHydrated();
  const token = useSaasAuthStore((s) => s.accessToken);
  const location = useLocation();

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-ink-muted">
        <p className="text-sm">Loading platform…</p>
      </div>
    );
  }

  if (!isSaasAccessToken(token)) {
    return <Navigate to={saasPath('/login')} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

