import { useEffect, useRef } from 'react';
import { isStoreAccessToken } from '@/lib/store-auth';
import { useAuthStore } from '@/stores/auth-store';
import { noteApiReachable, noteApiUnreachable, useConnectivityStore } from '@/stores/connectivity-store';
import { pingApiHealth } from '@/offline/connectivity-ping';
import { pullOfflineCatalog } from '@/offline/cache-pull';
import { processOfflineSaleSyncQueue, processOfflinePurchaseQueue } from '@/offline/sync-engine';

/**
 * Background connectivity checks, catalog warm-up while online, and offline sale sync.
 */
export function OfflineBootstrap() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const lastPullRef = useRef(0);
  const serverReachable = useConnectivityStore((s) => s.serverReachable);

  useEffect(() => {
    useConnectivityStore.getState().setNavigatorOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      const ok = await pingApiHealth();
      if (cancelled) return;
      if (ok) {
        noteApiReachable();
        void processOfflineSaleSyncQueue();
        void processOfflinePurchaseQueue();
      } else {
        noteApiUnreachable();
      }
      return ok;
    }

    void ping();
    const interval = window.setInterval(() => void ping(), 8_000);

    const onOnline = () => {
      useConnectivityStore.getState().setNavigatorOnline(true);
      void (async () => {
        const ok = await ping();
        if (ok) {
          await processOfflineSaleSyncQueue();
          await processOfflinePurchaseQueue();
        }
      })();
    };
    const onOffline = () => {
      useConnectivityStore.getState().setNavigatorOnline(false);
      noteApiUnreachable();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!isStoreAccessToken(accessToken) || !user) return;
    if (serverReachable !== true) return;
    if (!useConnectivityStore.getState().navigatorOnline) return;

    const now = Date.now();
    if (now - lastPullRef.current < 60_000) return;
    lastPullRef.current = now;

    const includeUsers = user.role === 'OWNER' || user.role === 'ADMIN';
    void pullOfflineCatalog({ includeUsers, includeRecentSales: true }).catch(() => {
      /* pull is best-effort */
    });
  }, [accessToken, user?.id, user?.role, serverReachable]);

  useEffect(() => {
    if (serverReachable !== true) return;
    if (!useConnectivityStore.getState().navigatorOnline) return;
    void processOfflineSaleSyncQueue();
    void processOfflinePurchaseQueue();
  }, [serverReachable]);

  // Periodic retry for queued items whose backoff has expired but no ping state change occurred.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const { serverReachable: sr, navigatorOnline } = useConnectivityStore.getState();
      if (sr === true && navigatorOnline) {
        void processOfflineSaleSyncQueue();
        void processOfflinePurchaseQueue();
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return null;
}
