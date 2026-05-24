import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type LicenseState = {
  token: string | null;
  publicKeyPem: string | null;
  /** Store slug from device activation (prefills login). */
  clientSlug: string | null;
  lastPingOkAt: number | null;
  lockReason: string | null;
  setLicense: (token: string, publicKeyPem: string, clientSlug?: string | null) => void;
  setLock: (reason: string | null) => void;
  notePingOk: () => void;
  clearLicense: () => void;
};

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set) => ({
      token: null,
      publicKeyPem: null,
      clientSlug: null,
      lastPingOkAt: null,
      lockReason: null,
      setLicense: (token, publicKeyPem, clientSlug) =>
        set({
          token,
          publicKeyPem,
          clientSlug: clientSlug?.trim() || null,
          lockReason: null,
          lastPingOkAt: Date.now(),
        }),
      setLock: (lockReason) => set({ lockReason }),
      notePingOk: () => set({ lastPingOkAt: Date.now(), lockReason: null }),
      clearLicense: () =>
        set({
          token: null,
          publicKeyPem: null,
          clientSlug: null,
          lastPingOkAt: null,
          lockReason: null,
        }),
    }),
    {
      name: 'pos-license-v1',
      partialize: (s) => ({
        token: s.token,
        publicKeyPem: s.publicKeyPem,
        clientSlug: s.clientSlug,
      }),
    },
  ),
);
