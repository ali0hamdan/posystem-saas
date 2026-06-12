/**
 * Orchestrates desktop startup:
 *   1) ensure ProgramData dirs
 *   2) ensure local PostgreSQL is initialized + running + db/role exist
 *   3) backup the database (best effort) before running migrations
 *   4) run Prisma `migrate deploy` against the local database
 *   5) start the local NestJS backend on 127.0.0.1:3001
 *   6) wait for /health
 *
 * Each step returns a structured result so main.cjs can render a meaningful
 * error window if anything fails.
 */
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const log = require('electron-log');

const { ensureDirs, getPaths } = require('./desktop-paths.cjs');
const pg = require('./local-postgres-manager.cjs');
const backend = require('./local-backend-manager.cjs');

const STEPS = {
  PATHS: 'paths',
  POSTGRES: 'postgres',
  BACKUP: 'backup',
  MIGRATE: 'migrate',
  BACKEND: 'backend',
  HEALTH: 'health',
};

function findPrismaCli() {
  const { backendNodeModules } = getPaths();
  const candidate = path.join(backendNodeModules, 'prisma', 'build', 'index.js');
  return fs.existsSync(candidate) ? candidate : null;
}

function runPrismaCommand(args, env) {
  return new Promise((resolve) => {
    const cli = findPrismaCli();
    const { backendRoot, logsDir } = getPaths();
    if (!cli) {
      return resolve({
        code: -1,
        stderr: 'Prisma CLI not found at backend/node_modules/prisma/build/index.js',
        stdout: '',
      });
    }
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: backendRoot,
      env: {
        ...process.env,
        ...env,
        ELECTRON_RUN_AS_NODE: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    const logFile = path.join(logsDir, 'prisma.log');
    const out = fs.createWriteStream(logFile, { flags: 'a' });
    out.write(`\n--- ${new Date().toISOString()} prisma ${args.join(' ')} ---\n`);
    child.stdout.on('data', (d) => {
      stdout += d.toString();
      out.write(d);
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
      out.write(d);
    });
    child.on('error', (err) => {
      out.write(String(err));
      resolve({ code: -1, stdout, stderr: stderr + String(err) });
    });
    child.on('close', (code) => {
      out.end();
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

async function runMigrations(databaseUrl) {
  const { prismaSchema } = getPaths();
  if (!fs.existsSync(prismaSchema)) {
    throw new Error(`Prisma schema missing at ${prismaSchema}`);
  }
  log.info('[migrate] running prisma migrate deploy');
  const r = await runPrismaCommand(
    ['migrate', 'deploy', '--schema', prismaSchema],
    { DATABASE_URL: databaseUrl },
  );
  if (r.code !== 0) {
    throw new Error(`Prisma migrate deploy failed (code ${r.code}). See logs/prisma.log\n${r.stderr.slice(-2000)}`);
  }
  return { ok: true, stdout: r.stdout };
}

async function backupBeforeMigrate(conn) {
  // Best effort. If pg_dump is unavailable, skip silently — Phase 11 covers the
  // explicit user-triggered backup flow with a hard failure path.
  const { backupsDir } = getPaths();
  const pgDump = pg.which('pg_dump');
  if (!pgDump) {
    log.warn('[backup] pg_dump not bundled; skipping pre-migration backup');
    return { skipped: true, reason: 'pg_dump unavailable' };
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(backupsDir, `nezhin-pre-migrate-${stamp}.dump`);
  return new Promise((resolve) => {
    const child = spawn(
      pgDump,
      ['-h', conn.host, '-p', String(conn.port), '-U', conn.user, '-d', conn.database, '-F', 'c', '-f', out],
      {
        env: { ...process.env, PGPASSWORD: conn.password },
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true,
      },
    );
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      if (code === 0) {
        log.info('[backup] wrote', out);
        resolve({ ok: true, path: out });
      } else {
        log.warn('[backup] pg_dump failed code', code, stderr.slice(-400));
        resolve({ ok: false, error: stderr });
      }
    });
    child.on('error', (err) => resolve({ ok: false, error: String(err) }));
  });
}

/**
 * @param {{ skipBackup?: boolean, skipMigrate?: boolean }} [opts]
 */
async function startAll(opts = {}) {
  const events = [];
  const record = (step, payload) => {
    events.push({ step, ...payload, at: Date.now() });
  };

  try {
    record(STEPS.PATHS, { phase: 'start' });
    ensureDirs();
    record(STEPS.PATHS, { phase: 'ok' });

    record(STEPS.POSTGRES, { phase: 'start' });
    if (!pg.isBinaryAvailable()) {
      throw Object.assign(
        new Error(
          'PostgreSQL runtime not found. The installer must place PostgreSQL binaries under resources/postgres-runtime/bin (Phase 12 TODO).',
        ),
        { step: STEPS.POSTGRES, code: 'PG_RUNTIME_MISSING' },
      );
    }
    const pgInfo = await pg.ensureRunning();
    record(STEPS.POSTGRES, { phase: 'ok', reused: pgInfo.reused, host: pgInfo.host, port: pgInfo.port });

    const conn = pg.getConnectionInfo();

    if (!opts.skipBackup) {
      record(STEPS.BACKUP, { phase: 'start' });
      const b = await backupBeforeMigrate(conn);
      record(STEPS.BACKUP, { phase: b.ok ? 'ok' : 'skipped', ...b });
    }

    if (!opts.skipMigrate) {
      record(STEPS.MIGRATE, { phase: 'start' });
      await runMigrations(conn.url);
      record(STEPS.MIGRATE, { phase: 'ok' });
    }

    record(STEPS.BACKEND, { phase: 'start' });
    const beInfo = await backend.start({ databaseUrl: conn.url });
    record(STEPS.BACKEND, { phase: 'ok', url: beInfo.url, reused: beInfo.reused });

    record(STEPS.HEALTH, { phase: 'start' });
    const healthy = await backend.waitForHealthy(15_000);
    if (!healthy) {
      throw Object.assign(new Error('Backend healthcheck failed after start'), {
        step: STEPS.HEALTH,
        code: 'HEALTH_TIMEOUT',
      });
    }
    record(STEPS.HEALTH, { phase: 'ok' });

    return { ok: true, events, connection: { ...conn, password: undefined }, backendUrl: beInfo.url };
  } catch (err) {
    log.error('[desktop] startup failed', err);
    return {
      ok: false,
      events,
      error: {
        step: err && err.step ? err.step : events[events.length - 1]?.step || 'unknown',
        code: err && err.code ? err.code : 'UNCAUGHT',
        message: err && err.message ? err.message : String(err),
      },
    };
  }
}

async function stopAll() {
  await backend.stop().catch(() => {});
  await pg.stopCluster().catch(() => {});
}

module.exports = {
  STEPS,
  startAll,
  stopAll,
  runMigrations,
  backupBeforeMigrate,
};
