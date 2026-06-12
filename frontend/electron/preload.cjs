const { contextBridge, ipcRenderer } = require('electron');

const UPDATER = 'electron-updater';

contextBridge.exposeInMainWorld('electronPrint', {
  getPrinters: () => ipcRenderer.invoke('electron-print:get-printers'),
  printSilent: (opts) => ipcRenderer.invoke('electron-print:silent', opts),
});

contextBridge.exposeInMainWorld('electronUpdater', {
  getVersions: () => ipcRenderer.invoke(`${UPDATER}:get-versions`),
  checkForUpdates: () => ipcRenderer.invoke(`${UPDATER}:check`),
  quitAndInstall: () => ipcRenderer.invoke(`${UPDATER}:quit-install`),
  onState: (handler) => {
    if (typeof handler !== 'function') return () => {};
    const listener = (_event, payload) => {
      try {
        handler(payload);
      } catch {
        /* ignore renderer handler errors */
      }
    };
    ipcRenderer.on(`${UPDATER}:state`, listener);
    return () => {
      ipcRenderer.removeListener(`${UPDATER}:state`, listener);
    };
  },
});

contextBridge.exposeInMainWorld('electronDiagnostics', {
  logSyncFailure: (info) => {
    ipcRenderer.send('electron-diagnostics:log-sync', info);
  },
  exportLogs: () => ipcRenderer.invoke('electron-diagnostics:export-logs'),
});

contextBridge.exposeInMainWorld('electronDesktop', {
  /** Returns { packaged, version, backendUrl, localServicesEnabled }. */
  getInfo: () => ipcRenderer.invoke('desktop:get-info'),
});

contextBridge.exposeInMainWorld('electronDesktopActivation', {
  /** { activated: false } before activation; otherwise the persisted license payload. */
  getStatus: () => ipcRenderer.invoke('desktop-activation:status'),
  /** Calls the hosted license server and persists the license locally. */
  activate: (payload) => ipcRenderer.invoke('desktop-activation:activate', payload),
  /** Clears the local license file. Requires { confirm: true }. */
  reset: (payload) => ipcRenderer.invoke('desktop-activation:reset', payload || {}),
});

contextBridge.exposeInMainWorld('electronDesktopBackup', {
  /** Trigger pg_dump to <ProgramData>/NezhinPOS/backups; returns { ok, path }. */
  exportBackup: (opts) => ipcRenderer.invoke('desktop-backup:export', opts || {}),
  /** Restore from a chosen .dump file; returns { ok }. */
  restoreBackup: (opts) => ipcRenderer.invoke('desktop-backup:restore', opts || {}),
  /** Lists backup files known to the local backups directory. */
  listBackups: () => ipcRenderer.invoke('desktop-backup:list'),
});
