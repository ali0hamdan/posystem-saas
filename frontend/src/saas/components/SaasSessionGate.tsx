import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { isSaasAccessToken } from '@/lib/saas-auth';
import { saasFetchMe } from '@/saas/api/saas-auth.api';
import { useSaasAuthStore } from '@/saas/stores/saas-auth-store';
import { saasPath } from '@/saas/config/saas-paths';

export function SaasSessionGate({ children }: { children: React.ReactNode }) {
  const token = useSaasAuthStore((s) => s.accessToken);
  const setSession = useSaasAuthStore((s) => s.setSession);
  const clearAuth = useSaasAuthStore((s) => s.clearAuth);

  const tokenValid = isSaasAccessToken(token);

  const meQuery = useQuery({
    queryKey: ['saas', 'me'],
    queryFn: ({ signal }) => saasFetchMe({ signal }),
    enabled: tokenValid,
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!token || !meQuery.data?.admin) {
      return;
    }
    setSession(token, meQuery.data.admin);
  }, [meQuery.data?.admin, token, setSession]);

  useEffect(() => {
    if (!token || !meQuery.isError) {
      return;
    }
    clearAuth();
  }, [meQuery.isError, token, clearAuth]);

  if (!tokenValid) {
    return <Navigate to={saasPath('/login')} replace />;
  }

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-ink-muted">
        <p className="text-sm">Verifying session…</p>
      </div>
    );
  }

  if (meQuery.isError) {
    return <Navigate to={saasPath('/login')} replace />;
  }

  return <>{children}</>;
}
