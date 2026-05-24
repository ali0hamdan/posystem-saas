import { useEffect, useState } from 'react';
import { useLicenseStore } from '@/stores/license-store';

/** Avoid flashing login vs activate before zustand persist rehydrates from localStorage. */
export function useLicenseHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useLicenseStore.persist.hasHydrated());

  useEffect(() => {
    if (useLicenseStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useLicenseStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return unsub;
  }, []);

  return hydrated;
}
