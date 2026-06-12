# Nezhin POS Desktop — packaging guide (work in progress)

This file documents the parts of the Phase 12 installer build that cannot be
fully automated inside this repo without external binaries. Everything else
(process management, migrations, activation, backups, CSP, 127.0.0.1 binding,
local secret generation) is wired up in `frontend/electron/` and the backend.

## TL;DR

Build flow (Windows, x64):

```powershell
# 1. Build the frontend + backend artifacts that go inside the installer
cd frontend
npm run desktop:prepare           # vite build  +  scripts/build-backend.mjs

# 2. Place the PostgreSQL runtime where electron-builder expects it
#    (see "PostgreSQL runtime" below)

# 3. Produce Nezhin POS-Setup-<version>.exe
npm run desktop:dist:win
```

Output: `dist/Nezhin POS-Setup-<version>.exe`.

## What goes inside the installer

`electron-builder` is configured (frontend/package.json) to ship:

- `frontend/dist/**` — the React build (loaded by `mainWindow.loadFile`)
- `frontend/electron/**` — main process, preload, all the `.cjs` managers
- `backend/dist/**` — compiled NestJS server (entrypoint: `dist/main.js`)
- `backend/prisma/**` — schema + migrations folder (runs `migrate deploy`)
- `backend/node_modules/**` — production deps only (`npm prune --omit=dev`)
- `backend/package.json`
- `../desktop-runtime/postgres/**` → `resources/postgres-runtime/**`

At runtime `desktop-paths.cjs` resolves all of these under
`process.resourcesPath`. In dev (`app.isPackaged === false`) they resolve to
the repo paths so `electron:dev:full` works against the source tree.

## PostgreSQL runtime — **manual step, gitignored**

We **do not** want to use SQLite (per spec). The installer needs the
PostgreSQL Windows x64 binaries available so `desktop-process-manager.cjs`
can spawn `initdb`, `postgres`, `psql`, `pg_dump`, `pg_restore`.

The `/desktop-runtime/` folder is **listed in `.gitignore`** — these
binaries must never be committed (they're large and license-bound). The
preflight script [`frontend/scripts/desktop-preflight.mjs`](../scripts/desktop-preflight.mjs)
runs before `electron-builder` and **fails the installer build with exit
code 1** if any of the expected binaries are missing. If they are missing
at runtime, the installed app's startup orchestrator throws
`PG_RUNTIME_MISSING` and renders the startup-error window.

Drop the binaries here on the build machine:

```
desktop-runtime/                  ← gitignored
  postgres/
    bin/
      initdb.exe                  ← required (first-run init)
      postgres.exe                ← required (cluster process)
      pg_ctl.exe                  ← required (binary detection)
      psql.exe                    ← required (role / db upsert)
      pg_dump.exe                 ← required (backup + pre-migrate snapshot)
      pg_restore.exe              ← required (restore IPC)
    lib/
      ...
    share/
      ...
```

Clean Windows VM test is **required** before any release ships — see the
manual smoke-test checklist at the bottom of this document.

Two recommended sources:

1. **Embedded zip** from the official PostgreSQL builds for Windows:
   <https://www.enterprisedb.com/download-postgresql-binaries> — pick the
   x64 zip for the latest 16.x or 15.x release, unpack `pgsql/` into
   `desktop-runtime/postgres/`.
2. **Vendored locally** — many Windows ISVs check in the trimmed-down zip
   under LFS. Acceptable here because the binaries are MIT-licensed and the
   only consumer is the desktop installer.

Add a build hook (or just a CI step) that:

1. Downloads / extracts the runtime to `desktop-runtime/postgres/`.
2. Removes unused locales, headers, and `share/doc` to slim the installer.

`local-postgres-manager.cjs` looks in `resources/postgres-runtime/bin` first
and falls back to a PATH-resolved binary — so developers can also run
`npm run electron:dev:full` against a system-wide install during iteration.
If nothing is found, startup fails with a clear error window. It does
**not** silently downgrade to SQLite.

### Suggested .gitignore additions

```
/desktop-runtime/
```

## Auto-update URL

`frontend/package.json` still ships the placeholder
`https://example.com/stock-pos-desktop-updates/`. Three ways to ship a
correctly-configured installer:

1. **Permanent fix (recommended):** edit `frontend/package.json` →
   `build.publish.url` to point at the real updates CDN, then commit.
2. **Per-build override:** set `DESKTOP_UPDATE_URL=https://your-feed/` in
   the build environment. The packaged app reads this at runtime via
   `autoUpdater.setFeedURL(...)` so you can flip CDNs without rebuilding
   the installer.
3. **Ship without auto-updates:** set `DESKTOP_DISABLE_UPDATES=1` for
   the build. The preflight passes and the runtime updater refuses to
   contact any host, returning a `disabled` IPC state to the renderer
   so the update banner can show "Updates not configured".

If none of the above is in place, **both** layers block:
- `frontend/scripts/desktop-preflight.mjs` fails the installer build.
- At runtime, [update-manager.cjs](update-manager.cjs) inspects
  `<resources>/app-update.yml`; if it still references `example.com`,
  it short-circuits and broadcasts `{ phase: 'disabled', message: ... }`
  to the renderer instead of letting `electron-updater` hammer the
  placeholder URL.

## NSIS installer notes

- `oneClick: false`, `perMachine: true`, `allowToChangeInstallationDirectory: true`
- Per-machine install is required because `<ProgramData>/NezhinPOS` needs
  to be writable by the service user. If the customer runs a non-admin
  install we fall back to `%LOCALAPPDATA%\NezhinPOS` (handled in
  `desktop-paths.cjs` → `getProgramDataRoot()`).
- We do **not** open ports through Windows Firewall — both the backend
  (`127.0.0.1:3001`) and Postgres (`127.0.0.1:55432`) bind only to the
  loopback interface and never need an inbound rule.

## Known-and-fixed packaging issues

### `ERR_REQUIRE_ESM` involving `@otplib/plugin-base32-scure` / `@scure/base`

**Symptom in `backend.log`:**

```
Error [ERR_REQUIRE_ESM]: require() of ES Module @scure/base/index.js
from @otplib/plugin-base32-scure/dist/index.cjs not supported.
```

**Why it happened:** `otplib@13.4.0` ships a CommonJS bundle and depends on
`@otplib/plugin-base32-scure`, which in turn depends on
`@scure/base@^2.0.0`. `@scure/base` 2.x is ESM-only (`"type": "module"`),
so the plugin's CJS `require('@scure/base')` aborts at module load. The
crash happened at NestJS boot before `/health` had any chance to respond.

**Fix:** added an `overrides` entry in `backend/package.json` pinning
`@scure/base` to `^1.2.6`. Version 1.x is the last line with dual CJS+ESM
exports (`"main": "./lib/index.js"`, `"exports": { ".": { "require":
"./lib/index.js", "import": "./lib/esm/index.js" } }`) and exposes the
same `base32.encode/decode` API the plugin uses. No source code changed.

**Why we did not switch packages at first:**
- `otplib` was still imported in `backend/src/saas/saas-auth.service.ts` for
  SaaS-admin 2FA. Swapping libraries required API changes there.
- The first fix was local to `backend/package.json` and was picked up
  cleanly by `npm install` / `npm prune --omit=dev` (the desktop install
  pipeline).

### `ERR_REQUIRE_ESM` involving `@otplib/plugin-crypto-noble` / `@noble/hashes`

**Symptom in `backend.log`** (immediately after the `@scure/base` fix above):

```
Error [ERR_REQUIRE_ESM]: require() of ES Module
node_modules/@noble/hashes/hmac.js from
node_modules/@otplib/plugin-crypto-noble/dist/index.cjs not supported.
```

**Why it happened:** `otplib@13` umbrella eagerly imports
`@otplib/plugin-crypto-noble`, which transitively pulls
`@noble/hashes@^2.0.1`. `@noble/hashes@2.x` is ESM-only. Worse,
**every** published version of `@otplib/plugin-crypto-noble` (13.0.0 →
13.4.1) `require()`s `@noble/hashes/legacy.js`, a subpath that only
exists in the v2 line. So even pinning `@noble/hashes` to v1 via
`overrides` doesn't help — the plugin's `require('@noble/hashes/legacy.js')`
fails with `MODULE_NOT_FOUND` instead.

**Fix:** swapped `otplib` for [`speakeasy`](https://www.npmjs.com/package/speakeasy)
(`backend/package.json`). Speakeasy is pure CommonJS, uses Node's built-in
`crypto` module — no ESM-only transitive deps — and the SaaS-admin 2FA
code path needs only 4 calls (`generateSecret`, `verify`, `otpauthURL`,
implicit `totp(secret)` for code generation). We added a thin
compatibility shim at the top of `backend/src/saas/saas-auth.service.ts`
so the rest of the service keeps the original `totp.generateSecret(…)`
/ `totp.verify(…)` / `totp.toURI(…)` call sites unchanged. The two
`overrides` from the earlier fix were kept as a belt-and-braces guard
against any future direct or transitive dep that pulls `@scure/base@^2`
or `@noble/hashes@^2`.

**Files affected:**
- `backend/package.json` — removed `otplib`, added `speakeasy`, kept the
  `@scure/base` override and added a matching `@noble/hashes` one.
- `backend/package-lock.json` — regenerated by `npm install`.
- `backend/src/saas/saas-auth.service.ts` — replaced the `otplib` require
  with `speakeasy` plus a 12-line shim that preserves the existing call
  surface.

### `EPERM` / `cannot access ... app.asar` during `electron-builder`

**Symptom:**

```
remove dist\win-unpacked\resources\app.asar:
The process cannot access the file because it is being used by another process.
```

**Why it happened:** when the repo lives under `OneDrive\` (or Dropbox /
Box / pCloud), the sync client grabs `app.asar` (~280 MB) for upload the
instant electron-builder finishes writing it. Defender real-time scan
piles on. The next packaging step then can't delete or overwrite the
file and the build aborts. Pausing OneDrive works for a single rebuild
but is fragile — and it pauses sync for every other folder on the
machine too.

**Fix:** added [`frontend/scripts/run-electron-builder.mjs`](../scripts/run-electron-builder.mjs)
— a wrapper that resolves a safe output directory before invoking
electron-builder. On Windows, when the repo is detected under a sync
root, it defaults to `%LOCALAPPDATA%\nezhin-builds`. Override the
location any time with `NEZHIN_BUILD_OUTPUT=<path>`. The wrapper also
spawns `electron-builder` via its JS entrypoint (`node_modules/electron-builder/out/cli/cli.js`)
to avoid Node 22's CVE-2024-27980 hardening that blocks plain `.cmd`
spawns.

The `frontend/package.json` `build.directories.output` field is now
`"${env.NEZHIN_BUILD_OUTPUT}"`, which electron-builder resolves at
runtime from the env var the wrapper sets.

**Where to find your installer after a successful build:**
- Windows under OneDrive: `%LOCALAPPDATA%\nezhin-builds\Nezhin POS-Setup-<version>.exe`
- Windows elsewhere or other OSes: `<repo>\dist\Nezhin POS-Setup-<version>.exe`
- Always overridable: `NEZHIN_BUILD_OUTPUT=D:\my-output npm run desktop:dist`

## Outstanding TODOs

- [ ] Wire `desktop-runtime/postgres/` download into CI before
      `npm run desktop:dist:win`.
- [ ] Replace `publish.url` with the real updates CDN.
- [ ] Generate `frontend/build/icon.ico` via `npm run icons:ico` and check
      it in (electron-builder needs the file present at build time).
- [ ] Add `LICENSE_RSA_PUBLIC_KEY_B64` to the installer's bundled env so
      the backend can verify hosted-signed tokens offline. This is the
      public key only — never ship the private key.

## Manual smoke test (Phase 14)

After `desktop:dist:win`:

1. Install the resulting `.exe` on a clean Windows VM.
2. Confirm `C:\ProgramData\NezhinPOS\` is created with `PostgreSQL/data`,
   `logs/`, `config/`, `backups/`, `license/`.
3. Confirm `netstat -ano | findstr "55432 3001"` shows both ports only on
   127.0.0.1.
4. First launch should show the activation screen (no `license.json` yet).
5. Activate with a non-HYBRID code → license file appears, local owner
   setup screen renders.
6. Disconnect the network → restart → app still boots and login works.
7. Export a backup → restart Postgres → restore → data matches.
