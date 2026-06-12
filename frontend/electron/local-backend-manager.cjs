/**
 * Local NestJS backend lifecycle for desktop mode.
 *
 * Runs the compiled backend (resources/backend/dist/main.js) as a child Node
 * process, bound to 127.0.0.1:3001 with DESKTOP_MODE=true. We use Electron's
 * bundled Node (process.execPath + ELECTRON_RUN_AS_NODE=1) so the installer
 * does not need to ship Node separately.
 */
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { spawn } = require('node:child_process');
const log = require('electron-log');

const { getPaths, ensureDir } = require('./desktop-paths.cjs');

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 3001;
const HEALTH_PATH = '/health';

let backendProcess = null;
let stopping = false;

function getBackendUrl() {
  return `http://${BACKEND_HOST}:${BACKEND_PORT}`;
}

function probeHealth(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: BACKEND_HOST, port: BACKEND_PORT, path: HEALTH_PATH, timeout: timeoutMs },
      (res) => {
        // Consume the body so the socket can be released.
        res.resume();
        resolve(res.statusCode === 200);
      },
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForHealthy(timeoutMs = 45_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await probeHealth()) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function buildEnv(databaseUrl, extraEnv = {}) {
  const { backendRoot, logsDir } = getPaths();
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    APP_MODE: 'desktop',
    DESKTOP_MODE: 'true',
    HOST: BACKEND_HOST,
    PORT: String(BACKEND_PORT),
    DATABASE_URL: databaseUrl,
    CORS_ORIGIN: 'http://127.0.0.1,file://',
    // The desktop runs in license-aware mode but does not require RSA signing
    // keys at boot — activation supplies the license token.
    BYPASS_LICENSE: process.env.DESKTOP_BYPASS_LICENSE === 'true' ? 'true' : 'false',
    // Strong dev-grade secret unless the installer provided one.
    JWT_SECRET:
      process.env.DESKTOP_JWT_SECRET || readOrCreateLocalSecret('jwt'),
    SAAS_JWT_SECRET:
      process.env.DESKTOP_SAAS_JWT_SECRET || readOrCreateLocalSecret('saas'),
    LICENSE_RSA_PUBLIC_KEY_B64: process.env.LICENSE_RSA_PUBLIC_KEY_B64 || '',
    LICENSE_RSA_PRIVATE_KEY_B64: process.env.LICENSE_RSA_PRIVATE_KEY_B64 || '',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    BACKEND_LOG_DIR: logsDir,
    // Resolve Prisma migrations relative to packaged backend.
    PRISMA_SCHEMA_PATH: path.join(backendRoot, 'prisma', 'schema.prisma'),
    ...extraEnv,
  };
  // Make sure Node uses Electron's runtime as plain Node.
  delete env.ELECTRON_NO_ATTACH_CONSOLE;
  return env;
}

function readOrCreateLocalSecret(kind) {
  const { configDir } = getPaths();
  ensureDir(configDir);
  const f = path.join(configDir, `${kind}.secret`);
  if (fs.existsSync(f)) {
    const v = fs.readFileSync(f, 'utf8').trim();
    if (v.length >= 32) return v;
  }
  const crypto = require('node:crypto');
  const secret = crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(f, secret, { mode: 0o600 });
  return secret;
}

async function start({ databaseUrl, extraEnv } = {}) {
  if (await probeHealth()) {
    log.info('[backend] reusing already-running backend on', getBackendUrl());
    return { reused: true, url: getBackendUrl() };
  }
  const { backendDistEntry, backendRoot, logsDir } = getPaths();
  if (!fs.existsSync(backendDistEntry)) {
    throw new Error(
      `Backend entry not found at ${backendDistEntry}. Did electron-builder include backend/dist as an extraResource?`,
    );
  }
  ensureDir(logsDir);

  const env = buildEnv(databaseUrl, extraEnv);
  const logFile = path.join(logsDir, 'backend.log');
  const out = fs.createWriteStream(logFile, { flags: 'a' });
  out.write(`\n--- ${new Date().toISOString()} starting backend ---\n`);

  log.info('[backend] spawning', backendDistEntry);
  backendProcess = spawn(process.execPath, [backendDistEntry], {
    cwd: backendRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  backendProcess.stdout.on('data', (d) => out.write(d));
  backendProcess.stderr.on('data', (d) => out.write(d));
  backendProcess.on('exit', (code, signal) => {
    if (!stopping) {
      log.error('[backend] exited unexpectedly', { code, signal });
    }
    backendProcess = null;
  });
  backendProcess.on('error', (err) => {
    log.error('[backend] spawn error', err);
  });

  const healthy = await waitForHealthy(60_000);
  if (!healthy) {
    throw new Error(
      `Backend did not become healthy at ${getBackendUrl()}${HEALTH_PATH} within 60s. See ${logFile}`,
    );
  }
  return { reused: false, url: getBackendUrl() };
}

function stop(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!backendProcess) return resolve();
    stopping = true;
    const child = backendProcess;
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      resolve();
    }, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    try {
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  });
}

module.exports = {
  BACKEND_HOST,
  BACKEND_PORT,
  HEALTH_PATH,
  start,
  stop,
  probeHealth,
  waitForHealthy,
  getBackendUrl,
};
