const { ipcMain, dialog } = require('electron');
const fs = require('fs/promises');
const log = require('electron-log');

/**
 * Desktop diagnostics: export local log file and receive anonymized renderer events.
 */
function setupDiagnostics(getMainWindow) {
  ipcMain.removeHandler('electron-diagnostics:export-logs');
  ipcMain.handle('electron-diagnostics:export-logs', async () => {
    try {
      const file = log.transports.file?.getFile?.();
      const logPath = file?.path;
      if (!logPath) {
        return { ok: false, message: 'Log file path unavailable' };
      }
      const win = getMainWindow();
      const { canceled, filePath } = await dialog.showSaveDialog(win && !win.isDestroyed() ? win : undefined, {
        title: 'Export logs',
        defaultPath: `stock-pos-${new Date().toISOString().slice(0, 10)}.log`,
        filters: [
          { name: 'Log', extensions: ['log', 'txt'] },
          { name: 'All', extensions: ['*'] },
        ],
      });
      if (canceled || !filePath) {
        return { ok: false, canceled: true };
      }
      await fs.copyFile(logPath, filePath);
      log.info('[diagnostics] logs exported to', filePath);
      return { ok: true, path: filePath };
    } catch (e) {
      const msg = e && typeof e.message === 'string' ? e.message : String(e);
      log.error('[diagnostics] export failed', e);
      return { ok: false, message: msg };
    }
  });

  ipcMain.removeAllListeners('electron-diagnostics:log-sync');
  ipcMain.on('electron-diagnostics:log-sync', (_evt, payload) => {
    const p = typeof payload === 'object' && payload ? payload : {};
    log.warn('[sync]', {
      localId: typeof p.localId === 'string' ? p.localId : undefined,
      code: typeof p.code === 'string' ? p.code : undefined,
      message:
        typeof p.message === 'string' ? p.message.slice(0, 500) : typeof p.message === 'number' ? p.message : undefined,
    });
  });
}

function setupProcessCrashLogging() {
  process.on('uncaughtException', (err) => {
    log.error('[process] uncaughtException', err);
  });
  process.on('unhandledRejection', (reason) => {
    log.error('[process] unhandledRejection', reason);
  });
}

function attachRendererCrashLogging(win) {
  if (!win?.webContents) return;
  win.webContents.on('render-process-gone', (_e, details) => {
    log.error('[renderer] render-process-gone', details);
  });
  win.webContents.on('unresponsive', () => {
    log.warn('[renderer] unresponsive');
  });
  win.webContents.on('responsive', () => {
    log.info('[renderer] responsive again');
  });
}

module.exports = { setupDiagnostics, setupProcessCrashLogging, attachRendererCrashLogging };
