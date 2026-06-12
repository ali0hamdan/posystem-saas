/**
 * Local PostgreSQL lifecycle manager for desktop mode.
 *
 * Listens ONLY on 127.0.0.1:55432. Database `nezhin_pos_local` and role
 * `nezhin_user` are created on first launch; the role password is generated
 * once and stored in <ProgramData>/NezhinPOS/config/pg.password (chmod 600
 * where the OS supports it).
 *
 * SQLite is intentionally NOT used.
 *
 * Bundling of the PostgreSQL binaries themselves is handled by the installer
 * (Phase 12). This module looks for them under resources/postgres-runtime/bin
 * and surfaces a clear error if they are missing — it never falls back to a
 * different database engine.
 */
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const log = require('electron-log');

const { getPaths, ensureDir } = require('./desktop-paths.cjs');

const PG_HOST = '127.0.0.1';
const PG_PORT = 55432;
const PG_DB = 'nezhin_pos_local';
const PG_USER = 'nezhin_user';
const PG_SUPERUSER = 'nezhin_admin';

function which(binName) {
  const exe = process.platform === 'win32' ? `${binName}.exe` : binName;
  const { postgresBinDir } = getPaths();
  const bundled = path.join(postgresBinDir, exe);
  if (fs.existsSync(bundled)) return bundled;
  // Fallback to PATH-resolved binary (useful in dev or when the user has
  // PostgreSQL installed system-wide). We do NOT silently use SQLite.
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [exe], {
    encoding: 'utf8',
  });
  if (r.status === 0) {
    const first = r.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0];
    if (first && fs.existsSync(first)) return first;
  }
  return null;
}

function generatePassword(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function readOrCreatePgPassword() {
  const { pgPasswordFile, configDir } = getPaths();
  ensureDir(configDir);
  if (fs.existsSync(pgPasswordFile)) {
    const v = fs.readFileSync(pgPasswordFile, 'utf8').trim();
    if (v) return v;
  }
  const pwd = generatePassword();
  fs.writeFileSync(pgPasswordFile, pwd, { mode: 0o600 });
  try {
    fs.chmodSync(pgPasswordFile, 0o600);
  } catch {
    /* ignore on Windows */
  }
  return pwd;
}

function readOrCreateSuperPassword() {
  const { configDir } = getPaths();
  ensureDir(configDir);
  const f = path.join(configDir, 'pg.super.password');
  if (fs.existsSync(f)) {
    const v = fs.readFileSync(f, 'utf8').trim();
    if (v) return v;
  }
  const pwd = generatePassword();
  fs.writeFileSync(f, pwd, { mode: 0o600 });
  return pwd;
}

function getConnectionInfo() {
  const password = readOrCreatePgPassword();
  const url = `postgresql://${PG_USER}:${encodeURIComponent(password)}@${PG_HOST}:${PG_PORT}/${PG_DB}`;
  return { host: PG_HOST, port: PG_PORT, database: PG_DB, user: PG_USER, password, url };
}

function isPortListening(host, port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

async function waitForReady(timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortListening(PG_HOST, PG_PORT)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function runBin(binPath, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(binPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, ...(opts.env || {}) },
      cwd: opts.cwd,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => resolve({ code: -1, stdout, stderr: stderr + String(err) }));
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

async function isClusterInitialized() {
  const { postgresDataDir } = getPaths();
  try {
    const pgVersion = path.join(postgresDataDir, 'PG_VERSION');
    await fsp.access(pgVersion);
    return true;
  } catch {
    return false;
  }
}

async function initCluster() {
  const initdb = which('initdb');
  if (!initdb) {
    throw new Error(
      'PostgreSQL initdb binary not found. The desktop installer must bundle PostgreSQL into resources/postgres-runtime/bin (see Phase 12).',
    );
  }
  const { postgresDataDir, configDir } = getPaths();
  ensureDir(path.dirname(postgresDataDir));
  ensureDir(configDir);

  const superPwd = readOrCreateSuperPassword();
  const pwfile = path.join(configDir, 'initdb.pwfile');
  fs.writeFileSync(pwfile, superPwd, { mode: 0o600 });
  try {
    log.info('[pg] initdb', postgresDataDir);
    const r = await runBin(initdb, [
      '-D',
      postgresDataDir,
      '-U',
      PG_SUPERUSER,
      '--pwfile',
      pwfile,
      '-E',
      'UTF8',
      '--locale=C',
      '--auth-host=scram-sha-256',
      '--auth-local=scram-sha-256',
    ]);
    if (r.code !== 0) {
      throw new Error(`initdb failed (code ${r.code}): ${r.stderr || r.stdout}`);
    }
  } finally {
    try {
      fs.unlinkSync(pwfile);
    } catch {
      /* ignore */
    }
  }

  // Lock postgresql.conf to loopback + non-default port.
  const confPath = path.join(postgresDataDir, 'postgresql.conf');
  const conf = await fsp.readFile(confPath, 'utf8').catch(() => '');
  const overrides = [
    '',
    '# === Nezhin POS desktop overrides ===',
    `listen_addresses = '${PG_HOST}'`,
    `port = ${PG_PORT}`,
    'unix_socket_directories = \'\'',
    'logging_collector = on',
    `log_directory = '${path.join(getPaths().logsDir, 'pg').replace(/\\/g, '/')}'`,
    "log_filename = 'postgresql-%Y-%m-%d.log'",
    'log_min_messages = warning',
    '',
  ].join('\n');
  await fsp.writeFile(confPath, conf + overrides, 'utf8');

  // pg_hba.conf: loopback + scram-sha-256 only.
  const hbaPath = path.join(postgresDataDir, 'pg_hba.conf');
  const hba = [
    '# Nezhin POS desktop — loopback only, scram-sha-256',
    'local   all             all                                     scram-sha-256',
    'host    all             all             127.0.0.1/32            scram-sha-256',
    'host    all             all             ::1/128                 scram-sha-256',
    '',
  ].join('\n');
  await fsp.writeFile(hbaPath, hba, 'utf8');

  ensureDir(path.join(getPaths().logsDir, 'pg'));
}

let pgProcess = null;
let stopping = false;

async function startCluster() {
  if (await isPortListening(PG_HOST, PG_PORT)) {
    log.info('[pg] already listening on', `${PG_HOST}:${PG_PORT}`);
    return { reused: true };
  }
  const pgCtl = which('pg_ctl');
  if (!pgCtl) {
    throw new Error(
      'PostgreSQL pg_ctl binary not found in resources/postgres-runtime/bin. See Phase 12 packaging TODO.',
    );
  }
  const { postgresDataDir, logsDir } = getPaths();
  const pgLogFile = path.join(logsDir, 'pg', 'startup.log');
  ensureDir(path.dirname(pgLogFile));

  // We use `postgres` directly so we own the child PID and can kill it on quit.
  const postgresBin = which('postgres');
  if (!postgresBin) {
    throw new Error('PostgreSQL postgres binary not found in resources/postgres-runtime/bin.');
  }
  pgProcess = spawn(
    postgresBin,
    ['-D', postgresDataDir, '-p', String(PG_PORT), '-h', PG_HOST],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, TZ: 'UTC' },
    },
  );
  const out = fs.createWriteStream(pgLogFile, { flags: 'a' });
  pgProcess.stdout.pipe(out);
  pgProcess.stderr.pipe(out);
  pgProcess.on('exit', (code) => {
    if (!stopping) log.warn('[pg] exited unexpectedly', code);
    pgProcess = null;
  });

  const ready = await waitForReady(45_000);
  if (!ready) {
    throw new Error(`PostgreSQL did not become ready on ${PG_HOST}:${PG_PORT} within 45s. See ${pgLogFile}`);
  }
  return { reused: false };
}

function stopCluster(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!pgProcess) return resolve();
    stopping = true;
    const child = pgProcess;
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
      // SIGTERM = fast smart shutdown for Postgres.
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  });
}

async function ensureDatabaseAndRole() {
  const psql = which('psql');
  if (!psql) {
    throw new Error('PostgreSQL psql binary not found.');
  }
  const superPwd = readOrCreateSuperPassword();
  const userPwd = readOrCreatePgPassword();
  const env = { PGPASSWORD: superPwd };

  const baseArgs = [
    '-h',
    PG_HOST,
    '-p',
    String(PG_PORT),
    '-U',
    PG_SUPERUSER,
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-X',
    '-q',
    '-t',
    '-A',
  ];

  const escape = (s) => String(s).replace(/'/g, "''");

  const exists = async (sql) => {
    const r = await runBin(psql, [...baseArgs, '-c', sql], { env });
    return r.code === 0 && r.stdout.trim() === '1';
  };

  if (!(await exists(`SELECT 1 FROM pg_roles WHERE rolname='${escape(PG_USER)}'`))) {
    log.info('[pg] creating role', PG_USER);
    const r = await runBin(
      psql,
      [
        ...baseArgs,
        '-c',
        `CREATE ROLE "${PG_USER}" LOGIN PASSWORD '${escape(userPwd)}'`,
      ],
      { env },
    );
    if (r.code !== 0) throw new Error(`create role failed: ${r.stderr}`);
  } else {
    // Keep the stored password in sync in case it was rotated.
    await runBin(
      psql,
      [
        ...baseArgs,
        '-c',
        `ALTER ROLE "${PG_USER}" WITH PASSWORD '${escape(userPwd)}'`,
      ],
      { env },
    );
  }

  if (!(await exists(`SELECT 1 FROM pg_database WHERE datname='${escape(PG_DB)}'`))) {
    log.info('[pg] creating database', PG_DB);
    const r = await runBin(
      psql,
      [...baseArgs, '-c', `CREATE DATABASE "${PG_DB}" OWNER "${PG_USER}"`],
      { env },
    );
    if (r.code !== 0) throw new Error(`create database failed: ${r.stderr}`);
  }
}

async function ensureRunning() {
  if (!(await isClusterInitialized())) {
    await initCluster();
  }
  const result = await startCluster();
  await ensureDatabaseAndRole();
  return { ...result, ...getConnectionInfo() };
}

function isBinaryAvailable() {
  return Boolean(which('postgres') && which('initdb') && which('pg_ctl') && which('psql'));
}

module.exports = {
  PG_HOST,
  PG_PORT,
  PG_DB,
  PG_USER,
  ensureRunning,
  stopCluster,
  getConnectionInfo,
  isBinaryAvailable,
  which,
};
