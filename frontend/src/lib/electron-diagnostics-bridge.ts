export type ElectronDiagnosticsBridge = {
  logSyncFailure: (info: { localId: string; message: string; code?: string }) => void;
  exportLogs: () => Promise<{ ok: boolean; canceled?: boolean; path?: string; message?: string }>;
};

export function isElectronDiagnosticsAvailable(): boolean {
  return typeof window !== 'undefined' && window.electronDiagnostics != null;
}

export function reportElectronSyncFailure(info: { localId: string; message: string; code?: string }): void {
  try {
    window.electronDiagnostics?.logSyncFailure?.(info);
  } catch {
    /* ignore */
  }
}

export async function exportElectronLogs(): Promise<{ ok: boolean; canceled?: boolean; path?: string; message?: string }> {
  if (!window.electronDiagnostics?.exportLogs) {
    return { ok: false, message: 'Not running in Electron' };
  }
  return window.electronDiagnostics.exportLogs();
}
