import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useLayoutEffect, type ReactNode } from 'react';
import { fetchMe } from '@/api/auth.api';
import { isStoreAccessToken } from '@/lib/store-auth';
import { useAuthStore } from '@/stores/auth-store';
import { useBranchStore } from '@/stores/branch-store';
import { noteApiUnreachable, useConnectivityStore } from '@/stores/connectivity-store';
import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen';
import { SessionErrorScreen } from '@/components/auth/SessionErrorScreen';

function sameUser(
  a: { id: string; username: string; role: string; isActive: boolean } | null | undefined,
  b: { id: string; username: string; role: string; isActive: boolean },
): boolean {
  return Boolean(a && a.id === b.id && a.username === b.username && a.role === b.role && a.isActive === b.isActive);
}

function isAxios401(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 401;
}

/** Network / timeout while `/auth/me` is unreachable (distinct from invalid token). */
function isRecoverableNetworkMeFailure(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  if (err.response?.status === 401) return false;
  return !err.response || err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED';
}

/**
 * After a token exists, validates it with GET /auth/me before rendering the app.
 * 401 is handled by the API client (session cleared). When the device is offline or the API
 * is unreachable, a persisted user profile may still be used for offline POS (catalog must
 * have been synced while online at least once).
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const persistedUser = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);

  const tokenValid = isStoreAccessToken(accessToken);

  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: ({ signal }) => fetchMe({ signal }),
    enabled: tokenValid,
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, err) => {
      if (isAxios401(err)) return false;
      if (isRecoverableNetworkMeFailure(err)) return false;
      return failureCount < 2;
    },
  });

  useLayoutEffect(() => {
    const next = query.data?.user;
    const branches = query.data?.branches;
    const permissions = query.data?.permissions ?? [];
    if (!query.isSuccess || !next || !accessToken) return;
    const prev = useAuthStore.getState().user;
    const prevPerms = useAuthStore.getState().permissions;
    if (!sameUser(prev, next) || prevPerms.join(',') !== permissions.join(',')) {
      setSession(accessToken, next, permissions);
    }
    if (branches?.length) {
      useBranchStore.getState().hydrateBranches(branches);
    }
  }, [query.isSuccess, query.data, accessToken, setSession]);

  useEffect(() => {
    if (query.isSuccess && query.data?.user) {
      useConnectivityStore.getState().setOfflineSession(false);
    }
  }, [query.isSuccess, query.data]);

  if (!tokenValid) {
    return null;
  }

  if (query.isPending) {
    return <AuthLoadingScreen message="Verifying your session…" />;
  }

  if (query.isError) {
    if (isRecoverableNetworkMeFailure(query.error) && persistedUser) {
      useConnectivityStore.getState().setOfflineSession(true);
      noteApiUnreachable();
      return <>{children}</>;
    }
    return (
      <SessionErrorScreen
        error={query.error}
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  }

  if (!query.isSuccess || !query.data?.user) {
    return <AuthLoadingScreen message="Loading your profile…" />;
  }

  return <>{children}</>;
}
