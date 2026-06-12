/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_STORE_NAME?: string;
  readonly VITE_CASHIER_CAN_VIEW_STOCK_MOVEMENTS?: string;
  /** Dev only: set `true` to skip license activation and enforcement UI. */
  readonly VITE_BYPASS_LICENSE?: string;
  /** Optional: browser Sentry DSN (never commit production secrets). */
  readonly VITE_SENTRY_DSN?: string;
}

declare const __STOCK_POS_VERSION__: string;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Preload may attach this for silent thermal printing (optional). */
interface ElectronPrintBridge {
  getPrinters?: () => Promise<{ name: string; displayName?: string }[]>;
  printSilent?: (opts: { silent?: boolean; deviceName?: string }) => Promise<{ ok: boolean; error?: string }>;
}

interface Window {
  electronPrint?: ElectronPrintBridge;
  electronUpdater?: {
    getVersions: () => Promise<{ shell: string; packaged: boolean }>;
    checkForUpdates: () => Promise<{ ok: boolean; skipped?: boolean; message?: string; updateInfo?: unknown }>;
    quitAndInstall: () => Promise<{ ok: boolean; skipped?: boolean; message?: string }>;
    onState: (handler: (payload: Record<string, unknown>) => void) => () => void;
  };
  electronDiagnostics?: {
    logSyncFailure: (info: { localId: string; message: string; code?: string }) => void;
    exportLogs: () => Promise<{ ok: boolean; canceled?: boolean; path?: string; message?: string }>;
  };
  electronDesktop?: {
    getInfo: () => Promise<{
      packaged: boolean;
      version: string;
      backendUrl: string | null;
      localServicesEnabled: boolean;
    }>;
  };
  electronDesktopActivation?: {
    getStatus: () => Promise<
      | { activated: false }
      | {
          activated: true;
          licenseToken?: string;
          licensePublicKeyPem?: string;
          clientId?: string;
          businessType: 'RETAIL' | 'FOOD_BEVERAGE' | 'WHOLESALE';
          planCode?: string;
          businessName?: string;
          ownerEmail?: string;
          lifetimeLicense: boolean;
          entitlements: {
            supportActive: boolean | null;
            cloudHostingActive: boolean | null;
            updatesActive: boolean | null;
            supportUntil?: string | null;
            cloudHostingUntil?: string | null;
            updatesUntil?: string | null;
          };
          activatedAt?: string;
        }
    >;
    activate: (payload: {
      activationCode: string;
      deviceName?: string;
    }) => Promise<
      | { ok: true; requiresLocalOwnerSetup: boolean; status: unknown }
      | { ok: false; code: string; message: string }
    >;
    reset: (payload: { confirm: true }) => Promise<{ ok: boolean; code?: string }>;
  };
  electronDesktopBackup?: {
    exportBackup: () => Promise<{ ok: boolean; path?: string; error?: string }>;
    restoreBackup: (opts: {
      filePath?: string;
      confirm: boolean;
    }) => Promise<{ ok: boolean; canceled?: boolean; error?: string; safetyPath?: string }>;
    listBackups: () => Promise<
      Array<{ name: string; path: string; size: number; modifiedAt: string }>
    >;
  };
}
