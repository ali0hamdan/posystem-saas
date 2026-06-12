import { useEffect, useRef } from 'react';
import { isStoreAccessToken } from '@/lib/store-auth';
import { IS_DESKTOP_APP } from '@/lib/env';
import { useAuthStore } from '@/stores/auth-store';
import { noteApiReachable, noteApiUnreachable, useConnectivityStore } from '@/stores/connectivity-store';
import { pingApiHealth } from '@/offline/connectivity-ping';
import { pullOfflineCatalog } from '@/offline/cache-pull';
import { processOfflineSaleSyncQueue, processOfflinePurchaseQueue } from '@/offline/sync-engine';
import { posOfflineDb } from '@/offline/pos-db';

/**
 * Background connectivity checks, catalog warm-up while online, and offline sale sync.
 *
 * Desktop note: in packaged Electron we run a local NestJS backend on
 * 127.0.0.1:3001, so the legacy Dexie offline queue is redundant and could
 * cause duplicate writes if a sale was queued while running web SaaS and
 * then migrated to desktop. We short-circuit all queue processing here.
 * Stale queue rows are detected and warned about — we deliberately do NOT
 * auto-flush them to the local backend, since they may reference a
 * different tenant entirely.
 */
export function OfflineBootstrap() {
  // -------------------------------------------------------------------
  // Desktop: bypass the entire offline queue pipeline.
  // -------------------------------------------------------------------
  if (IS_DESKTOP_APP) {
    return <DesktopOfflineBootstrap />;
  }
  return <WebOfflineBootstrap />;
}

/** Desktop-only no-op effect that just warns about any stale queue rows. */
function DesktopOfflineBootstrap() {
  useEffect(() => {
    void (async () => {
      try {
        const queued = await posOfflineDb.offlineSaleQueue.count();
        if (queued > 0) {
          console.warn(
            `[desktop] ignoring ${queued} stale Dexie offline-sale row(s). The desktop app writes directly to the local backend; the legacy web queue is disabled.`,
          );
        }
      } catch {
        /* IndexedDB may not be available — ignore */
      }
    })();
  }, []);
  return null;
}

function WebOfflineBootstrap() {
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
