#!/usr/bin/env node
/**
 * Prepares the backend artifacts that electron-builder ships as extraResources.
 *
 * Steps (run from this script's cwd):
 *   1) nest build           — produce backend/dist
 *   2) prisma generate      — generate the Prisma client into backend/node_modules
 *   3) npm install --omit=dev — slim node_modules for shipping
 *
 * Skipped automatically when SKIP_BACKEND_BUILD=1 (useful while iterating on
 * just the Electron shell).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..', '..', 'backend');

if (process.env.SKIP_BACKEND_BUILD === '1') {
  console.log('[desktop:build:backend] SKIP_BACKEND_BUILD=1 — skipping');
  process.exit(0);
}

if (!existsSync(path.join(backendDir, 'package.json'))) {
  console.error(`[desktop:build:backend] backend/package.json not found at ${backendDir}`);
  process.exit(1);
}

function run(cmd, args, { allowFailure = false } = {}) {
  console.log(`\n$ ${cmd} ${args.join(' ')}  (in ${backendDir})`);
  const isWin = process.platform === 'win32';
  const r = spawnSync(isWin ? `${cmd}.cmd` : cmd, args, {
    cwd: backendDir,
    stdio: 'inherit',
    env: process.env,
    shell: isWin,
  });
  if (r.status !== 0 && !allowFailure) {
    console.error(`[desktop:build:backend] step failed: ${cmd} ${args.join(' ')}`);
    process.exit(r.status ?? 1);
  }
  return r.status === 0;
}

run('npm', ['install', '--no-audit', '--no-fund']);
run('npm', ['run', 'build']);
run('npx', ['prisma', 'generate']);
run('npm', ['prune', '--omit=dev']);

console.log('\n[desktop:build:backend] done');
