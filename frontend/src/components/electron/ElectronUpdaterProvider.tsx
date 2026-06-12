import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  isElectronUpdaterAvailable,
  type ElectronUpdaterStatePayload,
  type ElectronVersionsInfo,
} from '@/lib/electron-updater';

type ElectronUpdaterContextValue = {
  payload: ElectronUpdaterStatePayload;
  versions: ElectronVersionsInfo | null;
  checkNow: () => Promise<void>;
};

const ElectronUpdaterContext = createContext<ElectronUpdaterContextValue>({
  payload: { phase: 'idle' },
  versions: null,
  checkNow: async () => {},
});

export function useElectronUpdater(): ElectronUpdaterContextValue {
  return useContext(ElectronUpdaterContext);
}

export function ElectronUpdaterProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<ElectronUpdaterStatePayload>({ phase: 'idle' });
  const [versions, setVersions] = useState<ElectronVersionsInfo | null>(null);

  useEffect(() => {
    if (!isElectronUpdaterAvailable()) {
      return;
    }
    const api = window.electronUpdater!;
    void api.getVersions().then(setVersions).catch(() => setVersions(null));
    const unsub = api.onState((p) =>
      setPayload((prev) => ({ ...prev, ...(p as ElectronUpdaterStatePayload) })),
    );
    return () => {
      unsub();
    };
  }, []);

  const checkNow = useCallback(async () => {
    if (!isElectronUpdaterAvailable()) return;
    // Defensive entitlement check in the renderer: if the customer's
    // Desktop Care Plan has expired the main process will already refuse
    // the IPC call, but checking here avoids a confusing "checking…"
    // flash before the disabled state arrives.
    if (typeof window.electronDesktopActivation !== 'undefined') {
      try {
        const status = await window.electronDesktopActivation.getStatus();
        if (status.activated && status.entitlements.updatesActive === false) {
          setPayload({
            phase: 'disabled',
            message: 'Updates expired. Renew your Desktop Care Plan to receive new updates.',
          });
          return;
        }
      } catch {
        /* fall through — let the main process speak */
      }
    }
    setPayload((p) => ({ ...p, phase: 'checking' }));
    try {
      await window.electronUpdater!.checkForUpdates();
    } catch {
      setPayload((p) => ({
        ...p,
        phase: 'error',
        message: 'Could not reach the update server.',
      }));
    }
  }, []);

  const value = useMemo(
    () => ({
      payload,
      versions,
      checkNow,
    }),
    [payload, versions, checkNow],
  );

  return <ElectronUpdaterContext.Provider value={value}>{children}</ElectronUpdaterContext.Provider>;
}
