#!/usr/bin/env node
/**
 * Desktop installer preflight.
 *
 * Run before `electron-builder` so a build cannot silently produce an
 * installer that is missing the PostgreSQL runtime, the icon, or the
 * compiled backend.
 *
 * Exits 1 on the first failure. Print one clear remediation hint per
 * missing item so a fresh build engineer can fix it without reading the
 * code.
 *
 * Skips: set `SKIP_DESKTOP_PREFLIGHT=1` for emergency rebuilds where you
 * accept the risk. Do not check that into CI.
 */
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendDir, '..');

if (process.env.SKIP_DESKTOP_PREFLIGHT === '1') {
  console.warn('[preflight] SKIP_DESKTOP_PREFLIGHT=1 — skipping all checks (you accept the risk)');
  process.exit(0);
}

const failures = [];

function check(label, predicate, remediation) {
  let ok = false;
  let detail = '';
  try {
    const r = predicate();
    if (typeof r === 'object' && r !== null && 'ok' in r) {
      ok = r.ok;
      detail = r.detail || '';
    } else {
      ok = Boolean(r);
    }
  } catch (e) {
    ok = false;
    detail = e instanceof Error ? e.message : String(e);
  }
  if (ok) {
    console.log(`  ✓ ${label}${detail ? `  (${detail})` : ''}`);
  } else {
    console.log(`  ✗ ${label}`);
    failures.push({ label, remediation, detail });
  }
}

function fileExists(relPath, fromRoot = false) {
  const base = fromRoot ? repoRoot : frontendDir;
  const full = path.resolve(base, relPath);
  if (!existsSync(full)) return { ok: false, detail: `not found at ${full}` };
  const st = statSync(full);
  if (!st.isFile()) return { ok: false, detail: `${full} is not a file` };
  if (st.size === 0) return { ok: false, detail: `${full} is empty (0 bytes)` };
  return { ok: true, detail: `${full} (${st.size} bytes)` };
}

function dirExists(relPath, fromRoot = false) {
  const base = fromRoot ? repoRoot : frontendDir;
  const full = path.resolve(base, relPath);
  if (!existsSync(full)) return { ok: false, detail: `not found at ${full}` };
  const st = statSync(full);
  return st.isDirectory()
    ? { ok: true, detail: full }
    : { ok: false, detail: `${full} is not a directory` };
}

console.log('\n[preflight] desktop installer preflight\n');

console.log('Installer assets:');
check(
  'frontend/build/icon.ico',
  () => fileExists('build/icon.ico'),
  'Run `npm run icons:ico` from `frontend/` to generate it.',
);

console.log('\nPostgreSQL runtime (desktop-runtime/postgres/bin/):');
for (const bin of ['postgres.exe', 'initdb.exe', 'pg_ctl.exe', 'psql.exe', 'pg_dump.exe', 'pg_restore.exe']) {
  check(
    `  ${bin}`,
    () => fileExists(`desktop-runtime/postgres/bin/${bin}`, true),
    `Download the PostgreSQL Windows x64 zip (e.g. from EnterpriseDB), unpack \`pgsql/\` into \`desktop-runtime/postgres/\`. See frontend/electron/DESKTOP_PACKAGING.md.`,
  );
}

console.log('\nBackend artifacts (built by desktop:build:backend):');
check(
  'backend/dist',
  () => dirExists('backend/dist', true),
  'Run `npm run desktop:build:backend` from `frontend/` (compiles NestJS into backend/dist).',
);
check(
  'backend/dist/main.js',
  () => fileExists('backend/dist/main.js', true),
  'Backend compile produced no entry. Check `cd backend && npm run build` output.',
);
check(
  'backend/prisma/migrations',
  () => dirExists('backend/prisma/migrations', true),
  'Migrations dir missing — confirm prisma schema and migrations are checked in.',
);
check(
  'backend/prisma/schema.prisma',
  () => fileExists('backend/prisma/schema.prisma', true),
  'Schema file missing — repository state is broken.',
);
check(
  'bundled Prisma CLI (backend/node_modules/prisma/build/index.js)',
  () => fileExists('backend/node_modules/prisma/build/index.js', true),
  'Run `cd backend && npm install && npx prisma generate`; the desktop runtime spawns this exact file to run `prisma migrate deploy`.',
);

console.log('\nUpdater configuration:');
check('electron-builder publish URL is not the example.com placeholder', () => {
  const pkg = JSON.parse(readFileSync(path.join(frontendDir, 'package.json'), 'utf8'));
  const url = pkg.build?.publish?.url ?? '';
  if (process.env.DESKTOP_DISABLE_UPDATES === '1') {
    return { ok: true, detail: 'DESKTOP_DISABLE_UPDATES=1 — updates intentionally disabled' };
  }
  if (process.env.DESKTOP_UPDATE_URL) {
    return { ok: true, detail: 'overridden by DESKTOP_UPDATE_URL env var' };
  }
  if (typeof url === 'string' && url.includes('example.com')) {
    return { ok: false, detail: `publish.url is still ${url}` };
  }
  return { ok: true, detail: url };
}, 'Either edit frontend/package.json `build.publish.url` to the real update CDN, set `DESKTOP_UPDATE_URL=https://...` for this build, or set `DESKTOP_DISABLE_UPDATES=1` to ship without auto-update.');

if (failures.length > 0) {
  console.error(`\n[preflight] ${failures.length} check(s) failed:\n`);
  for (const f of failures) {
    console.error(`  ✗ ${f.label}`);
    if (f.detail) console.error(`      ${f.detail}`);
    console.error(`      → ${f.remediation}`);
  }
  console.error('\nAborting installer build. Set SKIP_DESKTOP_PREFLIGHT=1 to bypass at your own risk.\n');
  process.exit(1);
}

console.log('\n[preflight] all checks passed\n');
