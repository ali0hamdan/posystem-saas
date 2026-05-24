/**
 * Auto-update wiring (electron-updater). Kept separate from window creation.
 * Logs to electron-log; pushes coarse UI state to the renderer via IPC.
 */
const { ipcMain, app } = require('electron');
const { autoUpdater } = require('electron-updater');

const CHANNEL = 'electron-updater';

let managerInstalled = false;

/** @param {import('electron').BrowserWindow | null} getWindow */
function setupUpdateManager(getWindow, log) {
  if (managerInstalled) {
    return;
  }
  managerInstalled = true;

  const send = (payload) => {
    try {
      const w = getWindow();
      if (w && !w.isDestroyed()) {
        w.webContents.send(`${CHANNEL}:state`, payload);
      }
    } catch (e) {
      log.warn('[updater] broadcast failed', e);
    }
  };

  ipcMain.removeHandler(`${CHANNEL}:get-versions`);
  ipcMain.removeHandler(`${CHANNEL}:check`);
  ipcMain.removeHandler(`${CHANNEL}:quit-install`);

  ipcMain.handle(`${CHANNEL}:get-versions`, async () => ({
    shell: app.getVersion(),
    packaged: app.isPackaged,
  }));

  if (!app.isPackaged) {
    log.info('[updater] Disabled in development (unpackaged build).');
    ipcMain.handle(`${CHANNEL}:check`, async () => {
      const msg = 'Updates are only installed from a packaged desktop build.';
      log.info('[updater] check skipped (dev)', msg);
      send({ phase: 'idle', message: msg });
      return { ok: false, skipped: true, message: msg };
    });
    ipcMain.handle(`${CHANNEL}:quit-install`, async () => {
      log.info('[updater] quit-install ignored (dev)');
      return { ok: false, skipped: true };
    });
    return;
  }

  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  let lastLoggedPctBucket = -1;
  autoUpdater.on('checking-for-update', () => {
    log.info('[updater] checking-for-update');
    send({ phase: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    log.info('[updater] update-available', info?.version);
    send({
      phase: 'available',
      version: info?.version,
      releaseDate: info?.releaseDate,
    });
  });
  autoUpdater.on('update-not-available', (info) => {
    log.info('[updater] update-not-available', info?.version);
    send({ phase: 'not-available', version: info?.version });
  });
  autoUpdater.on('error', (err) => {
    const message = err && typeof err.message === 'string' ? err.message : String(err);
    log.error('[updater] error', err);
    send({ phase: 'error', message });
  });
  autoUpdater.on('download-progress', (p) => {
    const bucket = Math.floor(Number(p.percent) / 10) * 10;
    if (bucket !== lastLoggedPctBucket) {
      lastLoggedPctBucket = bucket;
      log.info('[updater] download-progress', `${Math.round(p.percent)}%`);
    }
    send({
      phase: 'downloading',
      percent: p.percent,
      transferred: p.transferred,
      total: p.total,
      bytesPerSecond: p.bytesPerSecond,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    log.info('[updater] update-downloaded', info?.version);
    send({
      phase: 'downloaded',
      version: info?.version,
      releaseDate: info?.releaseDate,
    });
  });

  ipcMain.handle(`${CHANNEL}:check`, async () => {
    log.info('[updater] manual checkForUpdates');
    send({ phase: 'checking' });
    try {
      const result = await autoUpdater.checkForUpdates();
      return { ok: true, updateInfo: result?.updateInfo ?? null };
    } catch (e) {
      const message = e && typeof e.message === 'string' ? e.message : String(e);
      log.error('[updater] checkForUpdates failed', e);
      send({ phase: 'error', message });
      return { ok: false, message };
    }
  });

  ipcMain.handle(`${CHANNEL}:quit-install`, async () => {
    log.info('[updater] quitAndInstall requested from renderer');
    try {
      autoUpdater.quitAndInstall(false, true);
      return { ok: true };
    } catch (e) {
      const message = e && typeof e.message === 'string' ? e.message : String(e);
      log.error('[updater] quitAndInstall failed', e);
      return { ok: false, message };
    }
  });

  const startDelayMs = Number(process.env.ELECTRON_UPDATE_START_DELAY_MS || 2500);
  setTimeout(() => {
    log.info('[updater] startup checkForUpdates');
    autoUpdater.checkForUpdates().catch((e) => {
      log.warn('[updater] startup check failed', e);
      const message = e && typeof e.message === 'string' ? e.message : String(e);
      send({ phase: 'error', message });
    });
  }, startDelayMs);
}

module.exports = { setupUpdateManager, CHANNEL };
