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
}
