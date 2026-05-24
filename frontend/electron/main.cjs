const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const log = require('electron-log');
const { setupUpdateManager } = require('./update-manager.cjs');
const {
  setupDiagnostics,
  setupProcessCrashLogging,
  attachRendererCrashLogging,
} = require('./diagnostics.cjs');

log.initialize();
setupProcessCrashLogging();
log.info('[app] starting', { version: app.getVersion(), packaged: app.isPackaged });

/** @type {BrowserWindow | null} */
let mainWindow = null;

function getMainWindow() {
  return mainWindow;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';

  if (!app.isPackaged) {
    mainWindow.loadURL(devServerUrl).catch((e) => {
      log.error('[app] failed to load dev URL', devServerUrl, e);
    });
  } else {
    const indexHtml = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexHtml).catch((e) => {
      log.error('[app] failed to load index.html', indexHtml, e);
    });
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  attachRendererCrashLogging(mainWindow);
}

function setupPrintIpc() {
  const targetWin = () => BrowserWindow.getFocusedWindow() || getMainWindow();

  ipcMain.handle('electron-print:get-printers', async () => {
    const win = targetWin();
    if (!win || win.isDestroyed()) return [];
    try {
      const list = await win.webContents.getPrintersAsync();
      return (list || []).map((p) => ({
        name: p.name,
        displayName: p.displayName || p.description || p.name,
      }));
    } catch (e) {
      log.warn('[print] getPrinters failed', e);
      return [];
    }
  });

  ipcMain.handle('electron-print:silent', async (_evt, opts) => {
    const win = targetWin();
    if (!win || win.isDestroyed()) {
      return { ok: false, error: 'No active window' };
    }
    try {
      await win.webContents.print({
        silent: Boolean(opts?.silent),
        printBackground: false,
        deviceName: opts?.deviceName || undefined,
      });
      return { ok: true };
    } catch (e) {
      const msg = e && typeof e.message === 'string' ? e.message : String(e);
      log.error('[print] silent print failed', { message: msg });
      return { ok: false, error: msg };
    }
  });
}

app.whenReady().then(() => {
  setupPrintIpc();
  setupDiagnostics(getMainWindow);
  createWindow();
  setupUpdateManager(getMainWindow, log);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
