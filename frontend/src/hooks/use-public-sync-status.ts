import { useEffect, useState } from 'react';
import { useConnectivityStore, type PublicSyncUiStatus } from '@/stores/connectivity-store';

/** Re-evaluates periodically so the brief `synced` state can expire in the UI. */
export function usePublicSyncStatus(): PublicSyncUiStatus {
  const serverReachable = useConnectivityStore((s) => s.serverReachable);
  const navigatorOnline = useConnectivityStore((s) => s.navigatorOnline);
  const syncRunning = useConnectivityStore((s) => s.syncRunning);
  const lastSyncFinishedAt = useConnectivityStore((s) => s.lastSyncFinishedAt);
  const lastSyncHadFailures = useConnectivityStore((s) => s.lastSyncHadFailures);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  void tick;
  void serverReachable;
  void navigatorOnline;
  void syncRunning;
  void lastSyncFinishedAt;
  void lastSyncHadFailures;

  return useConnectivityStore.getState().derivePublicStatus();
}
