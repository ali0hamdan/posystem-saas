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
