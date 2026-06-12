/**
 * User-triggered backup/restore for the local PostgreSQL database.
 *
 * Backups are written to <ProgramData>/NezhinPOS/backups using pg_dump's
 * custom format so pg_restore can rebuild the schema deterministically.
 *
 * Restore always:
 *   1) prompts the user for the dump file
 *   2) requires { confirm: true } in the IPC payload so a stray renderer
 *      call can't silently overwrite production data
 *   3) writes a safety snapshot of the current DB first
 */
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { spawn } = require('node:child_process');
const { ipcMain, dialog } = require('electron');
const log = require('electron-log');

const { getPaths, ensureDir } = require('./desktop-paths.cjs');
const pg = require('./local-postgres-manager.cjs');

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function runBin(bin, args, { env, stdin } = {}) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      env: { ...process.env, ...(env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    if (stdin) {
      child.stdin?.end(stdin);
    }
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => resolve({ code: -1, stdout, stderr: stderr + String(err) }));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

async function exportBackup() {
  const pgDump = pg.which('pg_dump');
  if (!pgDump) {
    return {
      ok: false,
      error: 'pg_dump binary is not available. Install the desktop runtime (Phase 12).',
    };
  }
  const conn = pg.getConnectionInfo();
  const { backupsDir } = getPaths();
  ensureDir(backupsDir);
  const file = path.join(backupsDir, `nezhin-backup-${stamp()}.dump`);

  const r = await runBin(
    pgDump,
    ['-h', conn.host, '-p', String(conn.port), '-U', conn.user, '-d', conn.database, '-F', 'c', '-f', file],
    { env: { PGPASSWORD: conn.password } },
  );
  if (r.code !== 0) {
    log.error('[backup] pg_dump failed', r.stderr);
    return { ok: false, error: r.stderr || `pg_dump exited ${r.code}` };
  }
  log.info('[backup] wrote', file);
  return { ok: true, path: file };
}

async function restoreBackup({ filePath, confirm }) {
  if (!confirm) {
    return { ok: false, error: 'Restore requires { confirm: true } in the payload.' };
  }
  const pgRestore = pg.which('pg_restore');
  if (!pgRestore) {
    return { ok: false, error: 'pg_restore binary is not available.' };
  }
  if (!filePath || !fs.existsSync(filePath)) {
    return { ok: false, error: `Backup file not found: ${filePath}` };
  }
  const conn = pg.getConnectionInfo();

  // Safety snapshot of the current database before clobbering it.
  const { backupsDir } = getPaths();
  ensureDir(backupsDir);
  const safety = path.join(backupsDir, `nezhin-pre-restore-${stamp()}.dump`);
  const pgDump = pg.which('pg_dump');
  if (pgDump) {
    const snap = await runBin(
      pgDump,
      ['-h', conn.host, '-p', String(conn.port), '-U', conn.user, '-d', conn.database, '-F', 'c', '-f', safety],
      { env: { PGPASSWORD: conn.password } },
    );
    if (snap.code !== 0) {
      log.warn('[restore] safety snapshot failed; aborting restore', snap.stderr);
      return { ok: false, error: 'Safety snapshot failed; restore aborted.' };
    }
  }

  const r = await runBin(
    pgRestore,
    [
      '-h',
      conn.host,
      '-p',
      String(conn.port),
      '-U',
      conn.user,
      '-d',
      conn.database,
      '--clean',
      '--if-exists',
      '--no-owner',
      filePath,
    ],
    { env: { PGPASSWORD: conn.password } },
  );
  if (r.code !== 0) {
    log.error('[restore] pg_restore failed', r.stderr);
    return { ok: false, error: r.stderr || `pg_restore exited ${r.code}`, safetyPath: safety };
  }
  log.info('[restore] restored from', filePath, '(safety:', safety, ')');
  return { ok: true, safetyPath: safety };
}

async function listBackups() {
  const { backupsDir } = getPaths();
  ensureDir(backupsDir);
  const entries = await fsp.readdir(backupsDir).catch(() => []);
  const files = await Promise.all(
    entries
      .filter((f) => f.endsWith('.dump'))
      .map(async (f) => {
        const full = path.join(backupsDir, f);
        const st = await fsp.stat(full).catch(() => null);
        return st ? { name: f, path: full, size: st.size, modifiedAt: st.mtime.toISOString() } : null;
      }),
  );
  return files.filter(Boolean).sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
}

function setupBackupIpc() {
  ipcMain.removeHandler('desktop-backup:export');
  ipcMain.removeHandler('desktop-backup:restore');
  ipcMain.removeHandler('desktop-backup:list');

  ipcMain.handle('desktop-backup:export', async () => exportBackup());
  ipcMain.handle('desktop-backup:list', async () => listBackups());
  ipcMain.handle('desktop-backup:restore', async (_evt, payload) => {
    const safe =
      payload && typeof payload === 'object'
        ? {
            filePath: typeof payload.filePath === 'string' ? payload.filePath : undefined,
            confirm: payload.confirm === true,
          }
        : { confirm: false };
    if (!safe.filePath) {
      const win = require('electron').BrowserWindow.getFocusedWindow();
      const { canceled, filePaths } = await dialog.showOpenDialog(win || undefined, {
        title: 'Restore from backup',
        filters: [{ name: 'PostgreSQL dump', extensions: ['dump'] }],
        properties: ['openFile'],
      });
      if (canceled || !filePaths?.[0]) return { ok: false, canceled: true };
      safe.filePath = filePaths[0];
    }
    return restoreBackup(safe);
  });
}

module.exports = { setupBackupIpc, exportBackup, restoreBackup, listBackups };
