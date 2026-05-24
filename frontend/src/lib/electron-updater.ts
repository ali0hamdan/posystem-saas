/**
 * Renderer bridge for the Electron auto-updater (preload exposes `window.electronUpdater`).
 * Safe to import from the web build: all access is guarded.
 */

export type ElectronUpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export type ElectronUpdaterStatePayload = {
  phase: ElectronUpdatePhase;
  /** Hint text (e.g. dev build message). */
  message?: string;
  version?: string;
  releaseDate?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
};

export type ElectronVersionsInfo = {
  shell: string;
  packaged: boolean;
};

export type QuitInstallResult = { ok: boolean; skipped?: boolean; message?: string };

export type ElectronUpdaterBridge = {
  getVersions: () => Promise<ElectronVersionsInfo>;
  checkForUpdates: () => Promise<{ ok: boolean; skipped?: boolean; message?: string; updateInfo?: unknown }>;
  quitAndInstall: () => Promise<QuitInstallResult>;
  onState: (handler: (payload: ElectronUpdaterStatePayload) => void) => () => void;
};

export function isElectronUpdaterAvailable(): boolean {
  return typeof window !== 'undefined' && window.electronUpdater != null;
}
