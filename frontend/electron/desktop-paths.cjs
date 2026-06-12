/**
 * Centralized path resolver for desktop mode.
 *
 * Two roots:
 *   - ProgramData root (machine-wide writable data: db, logs, config, backups)
 *   - Resources root  (read-only packaged files: backend dist, prisma migrations,
 *     bundled PostgreSQL runtime when present)
 *
 * We keep ProgramData out of the per-user profile so Postgres data and backups
 * survive Windows user switches and so non-admin uninstalls don't wipe them.
 */
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { app } = require('electron');

const APP_DIR_NAME = 'NezhinPOS';

function getProgramDataRoot() {
  if (process.platform === 'win32') {
    const programData = process.env.ProgramData || 'C:\\ProgramData';
    return path.join(programData, APP_DIR_NAME);
  }
  // macOS / Linux fallback (single-user install).
  return path.join(os.homedir(), `.${APP_DIR_NAME.toLowerCase()}`);
}

function getResourcesRoot() {
  // In packaged builds, electron-builder places extraResources under process.resourcesPath.
  // In dev, fall back to the repo root so the same lookups work.
  if (app?.isPackaged) {
    return process.resourcesPath;
  }
  return path.join(__dirname, '..', '..');
}

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    if (e && e.code !== 'EEXIST') throw e;
  }
  return dir;
}

function getPaths() {
  const dataRoot = getProgramDataRoot();
  const resourcesRoot = getResourcesRoot();

  const postgresDataDir = path.join(dataRoot, 'PostgreSQL', 'data');
  const postgresRuntimeDir = path.join(resourcesRoot, 'postgres-runtime');
  const postgresBinDir = path.join(postgresRuntimeDir, 'bin');

  const logsDir = path.join(dataRoot, 'logs');
  const configDir = path.join(dataRoot, 'config');
  const backupsDir = path.join(dataRoot, 'backups');
  const licenseDir = path.join(dataRoot, 'license');

  // Packaged backend layout. We package the compiled backend under
  // resources/backend so it sits beside resources/postgres-runtime.
  const backendRoot = app?.isPackaged
    ? path.join(resourcesRoot, 'backend')
    : path.join(__dirname, '..', '..', 'backend');

  const backendDistEntry = path.join(backendRoot, 'dist', 'main.js');
  const backendPackageJson = path.join(backendRoot, 'package.json');
  const backendNodeModules = path.join(backendRoot, 'node_modules');
  const prismaDir = path.join(backendRoot, 'prisma');
  const prismaSchema = path.join(prismaDir, 'schema.prisma');
  const prismaMigrationsDir = path.join(prismaDir, 'migrations');

  return {
    dataRoot,
    resourcesRoot,
    postgresDataDir,
    postgresRuntimeDir,
    postgresBinDir,
    logsDir,
    configDir,
    backupsDir,
    licenseDir,
    backendRoot,
    backendDistEntry,
    backendPackageJson,
    backendNodeModules,
    prismaDir,
    prismaSchema,
    prismaMigrationsDir,
    configFile: path.join(configDir, 'desktop.json'),
    pgPasswordFile: path.join(configDir, 'pg.password'),
    licenseFile: path.join(licenseDir, 'license.json'),
  };
}

function ensureDirs() {
  const p = getPaths();
  ensureDir(p.dataRoot);
  ensureDir(p.logsDir);
  ensureDir(p.configDir);
  ensureDir(p.backupsDir);
  ensureDir(p.licenseDir);
  ensureDir(path.dirname(p.postgresDataDir));
  return p;
}

module.exports = {
  APP_DIR_NAME,
  getPaths,
  ensureDirs,
  ensureDir,
};
