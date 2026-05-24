import { create } from 'zustand';

export type PublicSyncUiStatus = 'online' | 'offline' | 'syncing' | 'synced' | 'sync_failed';

type ConnectivityState = {
  /** Result of last `/health` ping; `null` = not yet pinged. */
  serverReachable: boolean | null;
  /** Mirrors `navigator.onLine` so React can re-render when it changes. */
  navigatorOnline: boolean;
  syncRunning: boolean;
  lastSyncFinishedAt: number | null;
  lastSyncHadFailures: boolean;
  /** When true, session is using cached user without live `/auth/me` validation. */
  offlineSession: boolean;
  setServerReachable: (v: boolean | null) => void;
  setNavigatorOnline: (v: boolean) => void;
  setSyncRunning: (v: boolean) => void;
  markSyncFinished: (hadFailures: boolean) => void;
  setOfflineSession: (v: boolean) => void;
  shouldUseOfflineSales: () => boolean;
  derivePublicStatus: () => PublicSyncUiStatus;
};

export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  serverReachable: null,
  navigatorOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncRunning: false,
  lastSyncFinishedAt: null,
  lastSyncHadFailures: false,
  offlineSession: false,
  setServerReachable: (v) => set({ serverReachable: v }),
  setNavigatorOnline: (v) => set({ navigatorOnline: v }),
  setSyncRunning: (v) => set({ syncRunning: v }),
  markSyncFinished: (hadFailures) =>
    set({
      lastSyncFinishedAt: Date.now(),
      lastSyncHadFailures: hadFailures,
      syncRunning: false,
    }),
  setOfflineSession: (v) => set({ offlineSession: v }),
  shouldUseOfflineSales: () => {
    if (!get().navigatorOnline) return true;
    return get().serverReachable === false;
  },
  derivePublicStatus: () => {
    const { serverReachable, syncRunning, lastSyncFinishedAt, lastSyncHadFailures, navigatorOnline } = get();
    if (syncRunning) return 'syncing';
    if (!navigatorOnline || serverReachable === false) return 'offline';
    if (lastSyncHadFailures) return 'sync_failed';
    if (lastSyncFinishedAt && Date.now() - lastSyncFinishedAt < 2800) return 'synced';
    return 'online';
  },
}));

export function noteApiUnreachable(): void {
  useConnectivityStore.getState().setServerReachable(false);
}

export function noteApiReachable(): void {
  useConnectivityStore.getState().setServerReachable(true);
}
