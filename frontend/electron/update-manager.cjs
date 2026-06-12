/**
 * Auto-update wiring (electron-updater). Kept separate from window creation.
 * Logs to electron-log; pushes coarse UI state to the renderer via IPC.
 */
const { ipcMain, app } = require('electron');
const { autoUpdater } = require('electron-updater');

const CHANNEL = 'electron-updater';

let managerInstalled = false;

/**
 * Reads the persisted local-activation license file and returns a reason
 * string if the customer's updates entitlement is explicitly disabled.
 * Unknown/missing → null (don't block; preserves backward compatibility
 * for license files written before the entitlement field landed).
 */
function checkUpdatesEntitlement(log) {
  try {
    const { getPaths } = require('./desktop-paths.cjs');
    const fs = require('node:fs');
    const { licenseFile } = getPaths();
    if (!fs.existsSync(licenseFile)) return null;
    const text = fs.readFileSync(licenseFile, 'utf8');
    const parsed = text ? JSON.parse(text) : null;
    const updatesActive = parsed?.entitlements?.updatesActive;
    if (updatesActive === false) {
      return 'Updates expired. Renew your Desktop Care Plan to receive new updates.';
    }
    return null;
  } catch (e) {
    if (log && typeof log.warn === 'function') {
      log.warn('[updater] entitlement check failed', e);
    }
    return null;
  }
}

/**
 * Returns a human-readable reason string when auto-update must be turned
 * off in this packaged build, otherwise null.
 *   - `DESKTOP_DISABLE_UPDATES=1` → explicit opt-out
 *   - license.json says `entitlements.updatesActive === false` → the
 *     customer's Desktop Care Plan updates entitlement has expired
 *   - publish URL still has the example.com placeholder AND no
 *     `DESKTOP_UPDATE_URL` runtime override → misconfiguration; we refuse
 *     to query a placeholder host on every boot.
 */
function resolveDisabledReason(log) {
  if (process.env.DESKTOP_DISABLE_UPDATES === '1') {
    return 'Auto-update disabled by DESKTOP_DISABLE_UPDATES=1.';
  }
  const entitlementReason = checkUpdatesEntitlement(log);
  if (entitlementReason) return entitlementReason;
  if (process.env.DESKTOP_UPDATE_URL && process.env.DESKTOP_UPDATE_URL.trim()) {
    return null;
  }
  // electron-updater reads the publish URL from app-update.yml at runtime.
  // We mirror the build-time check the preflight script does so the app
  // never silently checks an example.com placeholder in the field.
  try {
    const path = require('node:path');
    const fs = require('node:fs');
    const yamlPath = path.join(process.resourcesPath || '', 'app-update.yml');
    if (fs.existsSync(yamlPath)) {
      const text = fs.readFileSync(yamlPath, 'utf8');
      if (/example\.com/i.test(text)) {
        return 'Auto-update disabled: publish URL is still the example.com placeholder. Set DESKTOP_UPDATE_URL or rebuild with a real publish URL.';
      }
    }
  } catch (e) {
    if (log && typeof log.warn === 'function') {
      log.warn('[updater] could not inspect app-update.yml', e);
    }
  }
  return null;
}

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

  // Safety: if the updater is misconfigured (publish URL still points at
  // example.com, or DESKTOP_DISABLE_UPDATES=1), do NOT start checking. We
  // refuse to spam a placeholder host or a stale CDN every startup.
  const disabledReason = resolveDisabledReason(log);
  if (disabledReason) {
    log.warn('[updater] auto-update disabled:', disabledReason);
    ipcMain.handle(`${CHANNEL}:check`, async () => {
      send({ phase: 'disabled', message: disabledReason });
      return { ok: false, skipped: true, message: disabledReason };
    });
    ipcMain.handle(`${CHANNEL}:quit-install`, async () => ({
      ok: false,
      skipped: true,
      message: disabledReason,
    }));
    send({ phase: 'disabled', message: disabledReason });
    return;
  }

  // Optional runtime override (CI builds can swap the feed without
  // editing package.json).
  const runtimeFeed = (process.env.DESKTOP_UPDATE_URL || '').trim();
  if (runtimeFeed) {
    try {
      autoUpdater.setFeedURL({ provider: 'generic', url: runtimeFeed });
      log.info('[updater] feed URL overridden via DESKTOP_UPDATE_URL', runtimeFeed);
    } catch (e) {
      log.warn('[updater] setFeedURL failed', e);
    }
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
