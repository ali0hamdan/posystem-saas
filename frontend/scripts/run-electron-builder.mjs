#!/usr/bin/env node
/**
 * Wrapper around `electron-builder` that resolves a safe output directory
 * before invocation.
 *
 * Why: when the repo is checked out under `OneDrive\` (or any other
 * file-sync root) on Windows, OneDrive grabs `dist\win-unpacked\resources
 * \app.asar` (~280 MB) for upload the instant electron-builder finishes
 * writing it. The next packaging step then can't delete or overwrite the
 * file and the build aborts with:
 *
 *   remove ...\dist\win-unpacked\resources\app.asar:
 *   The process cannot access the file because it is being used by
 *   another process.
 *
 * Resolution order:
 *   1. `NEZHIN_BUILD_OUTPUT` from the environment, if set
 *   2. `%LOCALAPPDATA%\nezhin-builds` on Windows when the repo lives
 *      under a known sync-root prefix (OneDrive / Dropbox / Box / pCloud)
 *   3. fallback to `../dist` (back-compat with any tooling that reads
 *      from the repo-relative folder)
 *
 * The resolved value is exported as `NEZHIN_BUILD_OUTPUT` for the
 * electron-builder child process so it's picked up by the `${env.NEZHIN_BUILD_OUTPUT}`
 * macro in `package.json` → `build.directories.output`.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendDir, '..');

const SYNC_ROOT_HINTS = ['onedrive', 'dropbox', 'box sync', 'pcloud'];

function isUnderSyncRoot(p) {
  const normalized = p.toLowerCase().replace(/\\/g, '/');
  return SYNC_ROOT_HINTS.some((hint) => normalized.includes(`/${hint}`));
}

function resolveOutputDir() {
  if (process.env.NEZHIN_BUILD_OUTPUT && process.env.NEZHIN_BUILD_OUTPUT.trim()) {
    return process.env.NEZHIN_BUILD_OUTPUT.trim();
  }
  const isWindows = process.platform === 'win32';
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  if (isWindows && isUnderSyncRoot(repoRoot)) {
    return path.join(localAppData, 'nezhin-builds');
  }
  return path.resolve(repoRoot, 'dist');
}

const outputDir = resolveOutputDir();
mkdirSync(outputDir, { recursive: true });

console.log(`[electron-builder] output → ${outputDir}`);
if (outputDir.toLowerCase().includes('onedrive')) {
  console.warn(
    '[electron-builder] WARNING: output directory still appears to be under a sync root. Builds may fail with EBUSY/EPERM on app.asar.',
  );
}

const args = process.argv.slice(2);
const isWindowsShell = process.platform === 'win32';
// Node 22's CVE-2024-27980 hardening forbids spawning .cmd shims without
// `shell: true`. Run the JS entrypoint of electron-builder directly so we
// stay shell-free on every platform.
const cliEntry = path.join(
  frontendDir,
  'node_modules',
  'electron-builder',
  'out',
  'cli',
  'cli.js',
);
const child = existsSync(cliEntry)
  ? spawn(process.execPath, [cliEntry, ...args], {
      cwd: frontendDir,
      stdio: 'inherit',
      env: { ...process.env, NEZHIN_BUILD_OUTPUT: outputDir },
    })
  : spawn(isWindowsShell ? 'electron-builder.cmd' : 'electron-builder', args, {
      cwd: frontendDir,
      stdio: 'inherit',
      env: { ...process.env, NEZHIN_BUILD_OUTPUT: outputDir },
      shell: isWindowsShell,
    });

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
child.on('error', (err) => {
  console.error('[electron-builder] failed to spawn:', err.message);
  process.exit(1);
});
