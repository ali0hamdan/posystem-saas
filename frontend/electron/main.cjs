const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('node:path');
const log = require('electron-log');
const { setupUpdateManager } = require('./update-manager.cjs');
const {
  setupDiagnostics,
  setupProcessCrashLogging,
  attachRendererCrashLogging,
} = require('./diagnostics.cjs');
const desktopProcessManager = require('./desktop-process-manager.cjs');
const startupErrorWindow = require('./startup-error-window.cjs');
const { setupBackupIpc } = require('./local-backup-manager.cjs');
const { setupActivationIpc } = require('./local-activation-manager.cjs');
const { BACKEND_HOST, BACKEND_PORT, getBackendUrl } = require('./local-backend-manager.cjs');

log.initialize();
setupProcessCrashLogging();
log.info('[app] starting', { version: app.getVersion(), packaged: app.isPackaged });

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {{ url: string } | null} */
let desktopServices = null;

function getMainWindow() {
  return mainWindow;
}

/**
 * In packaged desktop mode we run a local backend on 127.0.0.1:3001 — by
 * default the dev-mode shortcut just loads Vite + the cloud API. Setting
 * DESKTOP_LOCAL_SERVICES=true lets devs exercise the full desktop pipeline.
 */
function shouldRunLocalServices() {
  if (app.isPackaged) return true;
  const flag = String(process.env.DESKTOP_LOCAL_SERVICES || '').toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
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
  // Devtools are disabled by default in packaged builds. Set
  // DESKTOP_DEBUG=true at launch for support sessions.
  if (app.isPackaged && process.env.DESKTOP_DEBUG !== 'true') {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }
  // Lock down navigation to file:// (the packaged app) + the local backend.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed =
      url.startsWith(`http://${BACKEND_HOST}:${BACKEND_PORT}`) ||
      url.startsWith('file://') ||
      url.startsWith(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173');
    if (!allowed) {
      event.preventDefault();
      log.warn('[security] blocked navigation to', url);
    }
  });
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

function setupDesktopBridgeIpc() {
  ipcMain.handle('desktop:get-info', async () => ({
    packaged: app.isPackaged,
    version: app.getVersion(),
    backendUrl: desktopServices?.url || null,
    localServicesEnabled: shouldRunLocalServices(),
  }));
}

function applyDesktopCsp() {
  // Local-only CSP: allow self + the local backend, deny everything else.
  // Web SaaS deployments are unaffected (this only runs in Electron).
  const backend = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
  const csp = [
    "default-src 'self'",
    `connect-src 'self' ${backend} ws://${BACKEND_HOST}:${BACKEND_PORT}`,
    "img-src 'self' data: blob:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ].join('; ');
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    const headers = { ...details.responseHeaders };
    headers['Content-Security-Policy'] = [csp];
    cb({ responseHeaders: headers });
  });
}

async function bootDesktop() {
  if (!shouldRunLocalServices()) {
    log.info('[desktop] local services skipped (dev mode without DESKTOP_LOCAL_SERVICES)');
    return { ok: true, skipped: true };
  }
  log.info('[desktop] starting local services');
  const result = await desktopProcessManager.startAll();
  if (result.ok) {
    desktopServices = { url: result.backendUrl };
    log.info('[desktop] local services ready at', result.backendUrl);
  }
  return result;
}

app.whenReady().then(async () => {
  setupPrintIpc();
  setupDiagnostics(getMainWindow);
  setupDesktopBridgeIpc();
  setupBackupIpc();
  setupActivationIpc();

  if (app.isPackaged) {
    applyDesktopCsp();
  }

  const startup = await bootDesktop();
  if (!startup.ok) {
    startupErrorWindow.show({
      step: startup.error?.step,
      code: startup.error?.code,
      message: startup.error?.message,
      events: startup.events,
    });
    return;
  }

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

app.on('before-quit', async (event) => {
  if (!shouldRunLocalServices()) return;
  if (desktopProcessManager._stopping) return;
  event.preventDefault();
  desktopProcessManager._stopping = true;
  try {
    await desktopProcessManager.stopAll();
  } catch (e) {
    log.warn('[desktop] shutdown error', e);
  } finally {
    app.exit(0);
  }
});

// Expose for sibling modules that need to advertise the backend url.
module.exports = { getBackendUrl };
