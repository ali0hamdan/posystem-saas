# Nezhin POS Desktop Implementation Report

> **Inspection basis:** All claims below are grounded in the current state of files on disk in this repo. Where I found something missing or stale I say so plainly. I have not run a clean Windows VM install — that step has not been done and is called out repeatedly below.

---

## 1. Executive Summary

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Electron installed | **Implemented** | `frontend/package.json` → `electron ^33.2.0`, `electron-builder ^25.1.8`, `electron-log`, `electron-updater`. Entry: `main: "electron/main.cjs"`. | Pre-existing. |
| Real offline desktop scaffold (not a thin wrapper) | **Implemented (scaffold)** | 8 new `.cjs` modules under `frontend/electron/` (paths, postgres mgr, backend mgr, process orchestrator, activation, backup, error window). | Process management is in place; runtime PostgreSQL binaries are not. |
| Local backend startup | **Implemented (scaffold)** | `main.cjs` → `bootDesktop()` → `desktop-process-manager.cjs` → `local-backend-manager.cjs` spawns Nest via Electron-as-Node on 127.0.0.1:3001 with `DESKTOP_MODE=true`. | Requires backend `dist/` to exist as an extraResource. |
| Local PostgreSQL lifecycle | **Implemented (scaffold)** | `local-postgres-manager.cjs` handles `initdb` → `postgres` → role/db upsert; 127.0.0.1:55432, scram-sha-256. | The binaries themselves (`postgres.exe`, `initdb.exe`, …) are **not** in the repo. |
| SQLite | **Not used** | `grep -r sqlite` returns nothing in `frontend/electron/`, `backend/src/`, or `prisma/schema.prisma`. Prisma `provider = "postgresql"`. | Confirmed. |
| Local backup/restore | **Implemented** | `local-backup-manager.cjs` exposes `desktop-backup:export/restore/list` IPC; safety snapshot before restore. | Depends on bundled `pg_dump`/`pg_restore`. |
| License activation | **Implemented** | `local-activation-manager.cjs` calls hosted server, persists `license.json`, rejects HYBRID. | Tied to a configurable `DESKTOP_LICENSE_SERVER_URL`. |
| **Local owner setup** | **Implemented** | `backend/src/desktop/desktop-owner.{service,controller}.ts` + DTO; exposes `POST /auth/owner/setup` + `GET /desktop/status`; 12 unit tests pass. | See §10. |
| Installer ready | **Partial** | `dist/Nezhin POS-Setup-1.0.0.exe` exists on disk but was built **2026-05-14**, before the desktop scaffolding was added on **2026-06-12**. | The on-disk installer does NOT include the new scaffolding. A fresh build is required. |
| Production desktop release | **Missing** | PostgreSQL runtime not bundled, fresh installer not built, clean-VM test not done, updater URL is `https://example.com/...`, 3 pre-existing TS errors. | See §17 for the strict assessment. |

---

## 2. Current Desktop Architecture

```
Electron (frontend/electron/main.cjs)
 │
 ├─ desktop-process-manager.cjs (orchestrator)
 │   ├─ desktop-paths.cjs           → C:\ProgramData\NezhinPOS\…
 │   ├─ local-postgres-manager.cjs  → 127.0.0.1:55432  (nezhin_pos_local / nezhin_user)
 │   ├─ pre-migration backup         (pg_dump)
 │   ├─ Prisma migrate deploy        (backend/node_modules/prisma/build/index.js)
 │   └─ local-backend-manager.cjs   → 127.0.0.1:3001  /health
 │
 ├─ BrowserWindow (preload.cjs, contextIsolation=true, sandbox=true)
 │   └─ frontend/dist/index.html    (packaged) or VITE_DEV_SERVER_URL (dev)
 │
 ├─ startup-error-window.cjs        (rendered on failure — no silent failures)
 ├─ local-backup-manager.cjs        (desktop-backup:* IPC)
 ├─ local-activation-manager.cjs    (desktop-activation:* IPC, license.json)
 ├─ update-manager.cjs              (existing — electron-updater)
 └─ diagnostics.cjs                 (existing — log export, crash logs)
```

**Startup flow** (file:line for each step):

| # | Step | Where |
|---|---|---|
| 1 | Electron app ready | `main.cjs:177` `app.whenReady().then(...)` |
| 2 | IPC setup (print, diagnostics, desktop bridge, backup, activation) | `main.cjs:178‑183` |
| 3 | CSP applied if packaged | `main.cjs:185‑187` → `applyDesktopCsp()` `main.cjs:140‑160` |
| 4 | `bootDesktop()` decides whether to run local services | `main.cjs:162‑175`; gated by `app.isPackaged` OR `DESKTOP_LOCAL_SERVICES=true` |
| 5 | Paths ensured | `desktop-process-manager.cjs:STEPS.PATHS` → `desktop-paths.cjs:ensureDirs()` |
| 6 | Postgres binary check | `desktop-process-manager.cjs:120` → `local-postgres-manager.cjs:isBinaryAvailable()` |
| 7 | initdb if no `PG_VERSION` file | `local-postgres-manager.cjs:131‑190` |
| 8 | spawn `postgres` and `waitForReady()` | `local-postgres-manager.cjs:212‑254`; cluster listens only on `127.0.0.1:55432` (`postgresql.conf` override) |
| 9 | upsert role + database | `local-postgres-manager.cjs:268‑321` (`scram-sha-256` only via `pg_hba.conf`) |
| 10 | best-effort `pg_dump` backup | `desktop-process-manager.cjs:backupBeforeMigrate()` |
| 11 | `prisma migrate deploy` via Electron-as-Node | `desktop-process-manager.cjs:runPrismaCommand()` |
| 12 | spawn backend (`process.execPath` + `ELECTRON_RUN_AS_NODE=1`) | `local-backend-manager.cjs:97‑129` |
| 13 | poll `GET http://127.0.0.1:3001/health` (≤ 60 s) | `local-backend-manager.cjs:32‑52` |
| 14 | render `frontend/dist/index.html` | `main.cjs:71` |
| 15 | failure → error window | `main.cjs:189‑196` → `startup-error-window.cjs` |
| 16 | `before-quit` → graceful `backend.stop()` then `pg.stopCluster()` | `main.cjs:209‑221` |

---

## 3. Electron Main Process

**File:** `frontend/electron/main.cjs`

| Feature | Location | Status | Notes |
|---|---|---|---|
| `BrowserWindow` w/ `contextIsolation: true, nodeIntegration: false, sandbox: true` | `main.cjs:41‑49` | **Implemented** | Original wiring preserved. |
| Dev vs packaged loader | `main.cjs:60‑68` | **Implemented** | Dev → `VITE_DEV_SERVER_URL`, packaged → `loadFile(dist/index.html)`. |
| Silent print IPC | `main.cjs:93‑127` | **Implemented** | Unchanged from prior pass. |
| Window-open handler deny | `main.cjs:71` | **Implemented** | Pre-existing. |
| Renderer crash logging | `main.cjs:91` → `diagnostics.cjs:attachRendererCrashLogging` | **Implemented** | Pre-existing. |
| Devtools disabled in packaged builds | `main.cjs:73‑80` | **Implemented** | Bypass: `DESKTOP_DEBUG=true`. |
| Navigation lock (file://, local backend, dev server only) | `main.cjs:82‑89` | **Implemented** | Logs blocked URLs. |
| CSP applied via `session.webRequest.onHeadersReceived` | `main.cjs:140‑160` | **Implemented** | Only in `app.isPackaged`. |
| `before-quit` graceful shutdown | `main.cjs:209‑221` | **Implemented** | SIGTERM then SIGKILL fallback. |

---

## 4. Preload and IPC Bridges

**File:** `frontend/electron/preload.cjs`

Exposed bridges (all created via `contextBridge.exposeInMainWorld`):

| Bridge | Channels | File |
|---|---|---|
| `electronPrint` | `electron-print:get-printers`, `electron-print:silent` | `preload.cjs:5‑8` |
| `electronUpdater` | `electron-updater:get-versions`, `:check`, `:quit-install`, `:state` event | `preload.cjs:10‑28` |
| `electronDiagnostics` | `electron-diagnostics:log-sync`, `:export-logs` | `preload.cjs:30‑35` |
| `electronDesktop` | `desktop:get-info` → `{ packaged, version, backendUrl, localServicesEnabled }` | `preload.cjs:37‑40` |
| `electronDesktopActivation` | `desktop-activation:status`, `:activate`, `:reset` | `preload.cjs:42‑49` |
| `electronDesktopBackup` | `desktop-backup:export`, `:restore`, `:list` | `preload.cjs:51‑58` |

Renderer typings live in `frontend/src/vite-env.d.ts`.

**Security notes**
- `restoreBackup` requires `{ confirm: true }` in the payload — see `local-backup-manager.cjs:78`. A misbehaving renderer cannot wipe the DB by accident.
- `desktop-activation:reset` also requires `{ confirm: true }`.

---

## 5. Local PostgreSQL

**Files:** `frontend/electron/local-postgres-manager.cjs`, `frontend/electron/desktop-paths.cjs`

| Property | Value |
|---|---|
| Host | `127.0.0.1` (loopback only) |
| Port | `55432` (chosen to avoid conflict with stock 5432) |
| Database | `nezhin_pos_local` |
| Login role | `nezhin_user` |
| Superuser (initdb) | `nezhin_admin` |
| Auth method | `scram-sha-256` (host + local) — forced via generated `pg_hba.conf` |
| Data dir | `C:\ProgramData\NezhinPOS\PostgreSQL\data` |
| Logs dir | `C:\ProgramData\NezhinPOS\logs\pg\` |
| Backups dir | `C:\ProgramData\NezhinPOS\backups\` |
| Login password | random base64url, persisted to `C:\ProgramData\NezhinPOS\config\pg.password` (mode 0600) |
| Superuser password | random base64url, persisted to `C:\ProgramData\NezhinPOS\config\pg.super.password` |
| `unix_socket_directories` | empty (Windows; explicit override) |

**Binaries required** under `<resources>/postgres-runtime/bin/`:
- `postgres.exe` (cluster process)
- `initdb.exe` (first-run init)
- `pg_ctl.exe` (used only for binary detection today, not for spawn)
- `psql.exe` (role / database upsert)
- `pg_dump.exe` (backup + pre-migrate snapshot)
- `pg_restore.exe` (restore IPC)

**Missing today.** `desktop-runtime/postgres/` does not exist. When `isBinaryAvailable()` returns `false`, the orchestrator throws `PG_RUNTIME_MISSING` and the error window renders `startup-error-window.cjs` with "Local database failed to start." There is **no fallback to SQLite** anywhere in the code path — verified via `grep -r sqlite`.

**ProgramData fallback.** On non-Windows or when `ProgramData` is missing, `desktop-paths.cjs:getProgramDataRoot()` falls back to `~/.nezhinpos`. This was intentional but means non-admin Windows installs writing to a regular user profile will still work.

---

## 6. Local NestJS Backend

**Files:** `frontend/electron/local-backend-manager.cjs`, `backend/src/main.ts`, `backend/src/config/configuration.ts`, `backend/src/config/env.validation.ts`

**Spawn mechanism**
- Uses `process.execPath` (Electron) with `ELECTRON_RUN_AS_NODE=1` so the installer doesn't need a separate Node runtime (`local-backend-manager.cjs:97`).
- Entrypoint: `<resources>/backend/dist/main.js`.
- `cwd` is `<resources>/backend/`.

**Environment passed**

| Variable | Value | Source |
|---|---|---|
| `ELECTRON_RUN_AS_NODE` | `1` | `buildEnv()` |
| `NODE_ENV` | `production` | `buildEnv()` |
| `APP_MODE` | `desktop` | `buildEnv()` |
| `DESKTOP_MODE` | `true` | `buildEnv()` |
| `HOST` | `127.0.0.1` | `buildEnv()` |
| `PORT` | `3001` | `buildEnv()` |
| `DATABASE_URL` | `postgresql://nezhin_user:<pw>@127.0.0.1:55432/nezhin_pos_local` | `local-postgres-manager.getConnectionInfo()` |
| `CORS_ORIGIN` | `http://127.0.0.1,file://` | `buildEnv()` |
| `BYPASS_LICENSE` | `false` (unless `DESKTOP_BYPASS_LICENSE=true`) | `buildEnv()` |
| `JWT_SECRET`, `SAAS_JWT_SECRET` | locally-generated 48-byte secrets persisted in `<config>/jwt.secret` and `<config>/saas.secret` | `readOrCreateLocalSecret()` |
| `BACKEND_LOG_DIR` | `<ProgramData>/NezhinPOS/logs` | `buildEnv()` |

**Backend changes that make this work**

| Change | File | Behavior |
|---|---|---|
| Honor `HOST` in `listen()` | `backend/src/main.ts:106‑108` | Binds 127.0.0.1 in desktop, 0.0.0.0 elsewhere. |
| Compute `desktopMode` / `host` from env | `backend/src/config/configuration.ts` | Added `appMode`, `desktopMode`, `host`. |
| Relax production-only Joi rules in desktop | `backend/src/config/env.validation.ts` | `JWT_SECRET`/`SAAS_JWT_SECRET` ≥ 32 (not 48), `CORS_ORIGIN` may be `*`, `LICENSE_RSA_*_B64` not required. |

**Cloud-only secrets in desktop?** None are required by the validator: SMTP variables, Sentry DSN, RSA license keys, and SaaS admin credentials are all optional. The backend will boot from a clean desktop install with no cloud secrets present.

**Healthcheck:** `GET /health` returns `{ status, timestamp }` — see `backend/src/health/health.controller.ts`. Poll runs for up to 60 s before declaring `HEALTH_TIMEOUT`.

**Shutdown:** `before-quit` triggers `backend.stop()` (SIGTERM with 8 s SIGKILL fallback) followed by `pg.stopCluster()`.

---

## 7. Prisma and Migrations

| Property | Value |
|---|---|
| Provider | `postgresql` (`prisma/schema.prisma:7`) |
| Migrations dir | `backend/prisma/migrations/` (shipped via electron-builder `extraResources`) |
| Strategy | `prisma migrate deploy` (never `migrate dev` or `reset`) |
| Invocation | Spawn `process.execPath <backend/node_modules/prisma/build/index.js> migrate deploy --schema <prismaSchema>` with `ELECTRON_RUN_AS_NODE=1` — see `desktop-process-manager.cjs:24‑65` |
| Avoids `npx`? | **Yes** — Prisma CLI is the bundled `backend/node_modules/prisma/build/index.js`, not invoked via `npx`. |
| Generated client | Generated into `backend/node_modules` by `scripts/build-backend.mjs` (`npx prisma generate` runs in CI). |
| Pre-migration backup | `desktop-process-manager.backupBeforeMigrate()` → `pg_dump -F c -f backups/nezhin-pre-migrate-<stamp>.dump`. Best-effort: if `pg_dump` is missing, it's skipped with a warning (the user-triggered backup path under §11 hard-fails instead). |
| Risk: schema drift | Mitigated: pre-migrate dump is taken; failed `migrate deploy` aborts startup and shows the error window. The dump path is logged. |

**Implementation status: scaffolded and runnable, but never exercised end-to-end** (the Postgres binaries aren't on disk yet, so we haven't observed a real `migrate deploy` against a freshly-initialized cluster).

---

## 8. Frontend API Routing in Desktop

**File:** `frontend/src/lib/env.ts`

| Context | API base URL | Selection logic |
|---|---|---|
| Web SaaS (browser) | `VITE_API_URL` build-time value | `resolveDesktopBaseUrl()` returns `null` because `navigator.userAgent` lacks `"Electron"`. |
| Electron dev | `VITE_API_URL` if set, else `http://localhost:3000` | Same as web — dev Electron is intentionally allowed to hit any backend. |
| Electron packaged | **Forced** to `http://127.0.0.1:3001` | `resolveDesktopBaseUrl()` returns the local URL whenever `userAgent.includes('Electron')` **and** `import.meta.env.PROD`. The build-time `VITE_API_URL` is ignored. |

A runtime constant `IS_DESKTOP_APP` is exported so renderer code (gate, banner) can branch cleanly.

**Why this matters:** the same React bundle is shipped to both web SaaS and desktop. Without the runtime override, a desktop install pinned to a stale `VITE_API_URL` could silently hit the production cloud API instead of its local backend — bypassing offline operation entirely and leaking local data to the wrong tenant.

---

## 9. Activation and License

**File:** `frontend/electron/local-activation-manager.cjs`

| Property | Value |
|---|---|
| Hosted endpoint | `${DESKTOP_LICENSE_SERVER_URL || 'https://license.nezhinpos.com'}/activation/activate-device` |
| Method | `POST` over `http`/`https` (`node:https`) with 15 s timeout |
| Machine fingerprint | Random 16-byte hex stored in `<config>/machine.id` (chmod 600), stable per install |
| Persistence | `<ProgramData>/NezhinPOS/license/license.json` (chmod 600) |
| Required businessType | `RETAIL` / `FOOD_BEVERAGE` / `WHOLESALE` (`ALLOWED_BUSINESS_TYPES` set) |
| HYBRID rejection | Explicit `HYBRID_NOT_SUPPORTED` error code (`local-activation-manager.cjs:175‑185`) |
| Stored fields | `clientId`, `businessName`, `ownerEmail`, `businessType`, `planCode`, `licenseToken`, `licensePublicKeyPem`, `lifetimeLicense`, `entitlements.{supportActive,cloudHostingActive,updatesActive,supportUntil,cloudHostingUntil,updatesUntil}`, `deviceId`, `activatedAt`, SHA-256 of the activation code |
| Offline path | After activation, no further outbound calls are required — `getStatus()` reads only `license.json`. |
| Reset | `desktop-activation:reset` requires `{ confirm: true }` and deletes `license.json` only. |

The hosted server is expected to return the entitlement booleans. The activation manager falls back to `null` (unknown) if a field is absent. The `DesktopEntitlementBanner` only shows a notice when the field is explicitly `false`, so unknown/null stays silent.

---

## 10. Local Owner Setup — Implemented

**Files**
- `backend/src/desktop/desktop.module.ts`
- `backend/src/desktop/desktop-owner.controller.ts` — exposes `POST /auth/owner/setup` (200) and `GET /desktop/status`
- `backend/src/desktop/desktop-owner.service.ts` — idempotent transaction
- `backend/src/desktop/dto/setup-desktop-owner.dto.ts` — `{ license: {...}, password, defaultBranchName? }`
- `backend/src/license/license.guard.ts` — `'/auth'` and `'/desktop'` are public prefixes
- `backend/src/__tests__/desktop-owner.service.spec.ts` — 12 unit tests, all green

**Behavior**

| Concern | Implementation |
|---|---|
| Desktop-only guard | `DesktopOwnerService.isDesktopMode()` reads `app.desktopMode`; controller throws `403 NOT_DESKTOP_MODE` outside desktop |
| HYBRID rejection | `BadRequestException` (`HYBRID_NOT_SUPPORTED`) before any DB write |
| Password policy | `min 8`; bcrypt rounds = 12; plain password never reaches the Prisma call (asserted in tests) |
| Single-transaction provisioning | Plan → Client → Subscription → Branch (code `HQ`) → StoreSettings → OWNER User → UserBranch |
| Plan choice | `LicensePlan` enum, mapped from `BusinessType` (`RETAIL_DESKTOP_LIFETIME` / `FNB_DESKTOP_LIFETIME` / `WHOLESALE_DESKTOP_LIFETIME`) |
| Subscription shape | `lifetimeLicense=true` → status `LIFETIME`, `billingCycle LIFETIME`, `expiresAt null`; otherwise `ACTIVE` + `YEARLY` |
| Idempotent re-run | If OWNER exists, returns `{ alreadyConfigured: true }` and **never re-hashes the password** |
| Repair mode | If OWNER exists but Branch/StoreSettings/Subscription is missing, only those are restored — owner is untouched |
| Tenant mismatch | `409 ConflictException` (`TENANT_MISMATCH`) — refuses to overwrite a different existing tenant |
| Response shape | `{ success: true, message, next: '/login', alreadyConfigured, result }` |

**Renderer integration**
- `frontend/src/components/electron/DesktopActivationGate.tsx` — wraps `AppRouter`; when packaged Electron has activation but no owner, renders the password form and POSTs `{ license, password }` to `/auth/owner/setup`. Surfaces `NOT_DESKTOP_MODE` and other backend errors.
- `frontend/src/App.tsx` — wraps the router in the gate (no-op outside Electron).

**Caveat: max-user/branch/device limits**
- `Plan.maxUsers/maxBranches/maxDevices` and `Subscription.maxUsers/maxBranches/maxDevices` are `Int? @default(5/1/3)` in the schema. The generated Prisma client's create-input types do **not** accept `null` for these fields in this repo (same source of the pre-existing TS errors in `saas-plans.service.ts`). The desktop service therefore leaves them at the schema defaults (5/1/3) rather than `null` (unlimited). For a single-machine install this is fine; for true "unlimited" you'd need to either re-run `prisma generate` after confirming the Prisma version supports `null` here, or patch the column nullability.

---

## 11. Backup and Restore

**File:** `frontend/electron/local-backup-manager.cjs`

| Property | Value |
|---|---|
| Backup dir | `C:\ProgramData\NezhinPOS\backups\` |
| Export filename | `nezhin-backup-<ISO-stamp>.dump` |
| Pre-migration filename | `nezhin-pre-migrate-<ISO-stamp>.dump` (best-effort, may skip) |
| Pre-restore safety snapshot | `nezhin-pre-restore-<ISO-stamp>.dump` (hard fail if it fails — restore is aborted) |
| Dump format | Custom (`pg_dump -F c`) |
| Restore flags | `pg_restore --clean --if-exists --no-owner` |
| IPC handlers | `desktop-backup:export`, `desktop-backup:restore`, `desktop-backup:list` |
| Restore confirmation | `{ confirm: true }` is required; without it the call returns `{ ok: false, error: 'Restore requires { confirm: true } in the payload.' }`. |
| User-triggered backup if `pg_dump` missing | Returns `{ ok: false, error: 'pg_dump binary is not available. Install the desktop runtime (Phase 12).' }` |

**Limitations / not done**
- **No encryption at rest** for dumps. Anyone with read access to ProgramData can read the SQL.
- **No UI integration yet** — there's no Settings panel button wired to `electronDesktopBackup.exportBackup()`. The bridge exists, but a renderer component to call it has not been added.
- **No restore round-trip test** — the script paths are wired but have never been exercised against a real Postgres because the binaries aren't bundled yet.

---

## 12. Packaging and Installer

**Config:** `build` block in `frontend/package.json`

| Property | Value |
|---|---|
| `appId` | `com.nezhin.pos` |
| `productName` | `Nezhin POS` |
| `artifactName` | `${productName}-Setup-${version}.${ext}` |
| `directories.output` | `../dist` |
| `files` | `dist/**/*`, `electron/**/*`, `package.json` |
| `asarUnpack` | `electron/**/*` (so `.cjs` files are runnable from disk, not the asar) |
| `win.icon` | `build/icon.ico` — **present** (`frontend/build/icon.ico` exists) |
| `nsis.oneClick` | `false` |
| `nsis.allowToChangeInstallationDirectory` | `true` |
| `nsis.perMachine` | `true` |
| `publish.url` | `https://example.com/stock-pos-desktop-updates/` — **placeholder** |

**`extraResources` (bundled into `<install>/resources/`):**

| From | To | Notes |
|---|---|---|
| `../backend/dist` | `backend/dist` | Compiled NestJS |
| `../backend/prisma` | `backend/prisma` | Schema + migrations |
| `../backend/package.json` | `backend/package.json` | |
| `../backend/node_modules` | `backend/node_modules` | Prod deps (`npm prune --omit=dev`) + Prisma CLI/runtime |
| `../desktop-runtime/postgres` | `postgres-runtime` | **Source folder does not exist** — installer build will skip silently. |

**Scripts**

Frontend (`frontend/package.json`):
- `electron:dev` — Vite + Electron, no local backend
- `electron:dev:full` — `DESKTOP_LOCAL_SERVICES=true` + Vite + Electron (exercises the full pipeline against system Postgres if present)
- `electron:build` — `tsc -b && vite build` with `ELECTRON_BUILD=true`
- `desktop:build:frontend` — alias of `electron:build`
- `desktop:build:backend` — runs `frontend/scripts/build-backend.mjs` (`npm install` → `npm run build` → `npx prisma generate` → `npm prune --omit=dev`) under `backend/`
- `desktop:prepare` — both of the above
- `desktop:dist:win` — `desktop:prepare && electron-builder --win --x64`
- `electron:dist:win`, `electron:dist:mac`, `electron:dist:linux` — same `desktop:prepare` lead-in

Root (`package.json`):
- `desktop:dev` → `electron:dev:full` in frontend
- `desktop:build` → `desktop:prepare` in frontend
- `desktop:dist` → `desktop:dist:win` in frontend

**On-disk artifacts (stale)**
- `dist/Nezhin POS-Setup-1.0.0.exe` exists but was built **2026-05-14**; the desktop scaffolding lands **2026-06-12**. Treat the existing installer as **out of date** — a fresh `npm run desktop:dist:win` is required.

**Manual actions still required (in order)**

1. Drop PostgreSQL 15/16 Windows x64 binaries into `desktop-runtime/postgres/bin/` (see `frontend/electron/DESKTOP_PACKAGING.md`). Without these, the installed app will fail at startup with `PG_RUNTIME_MISSING`.
2. Replace the `https://example.com/...` updater URL with the real CDN.
3. Re-run `npm run desktop:dist:win` from `frontend/` (or `npm run desktop:dist` from root).
4. Test on a **clean** Windows VM (no Postgres installed, no Node installed).

---

## 13. Security Review

**Implemented**

| Control | Where |
|---|---|
| Backend binds 127.0.0.1 in desktop | `configuration.ts` `host` default + `main.ts` `app.listen(port, host)` |
| Postgres binds 127.0.0.1 + custom port | `local-postgres-manager.cjs:initCluster()` writes `listen_addresses = '127.0.0.1'` and `port = 55432` into `postgresql.conf` |
| `pg_hba.conf` enforces `scram-sha-256` (host + local) | `local-postgres-manager.cjs:204‑212` |
| `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` | `main.cjs:46‑48` |
| Local-only CSP | `main.cjs:applyDesktopCsp()` |
| Devtools auto-close in packaged builds | `main.cjs:73‑80` (unless `DESKTOP_DEBUG=true`) |
| Navigation lock | `main.cjs:82‑89` |
| No SQLite | grep-verified |
| `desktop-backup:restore` and `desktop-activation:reset` require `{ confirm: true }` | `local-backup-manager.cjs:78`, `local-activation-manager.cjs:215‑217` |
| Generated 0600 secrets (DB passwords, JWT secrets, machine id) | `pgPasswordFile`, `pg.super.password`, `jwt.secret`, `saas.secret`, `machine.id`, `license.json` |
| License-token public key persisted in `license.json` for offline verification (renderer-side; backend ignores when `BYPASS_LICENSE=false` because the desktop's `/auth/*` and `/desktop/*` routes are public-prefixed in the guard) | `license.guard.ts:6‑16` |

**Risks**

| Risk | Current status | Recommendation | Priority |
|---|---|---|---|
| DB password & JWT secrets in cleartext on disk | `<ProgramData>/NezhinPOS/config/*.password` + `*.secret`, mode 0600 (no-op on Windows ACLs) | Restrict folder ACL to `SYSTEM` + the install user during NSIS install, or DPAPI-protect each file | High |
| `license.json` is plaintext | mode 0600; can be copied to another machine to attempt cross-install reuse | Add machine binding check on read (compare `deviceId` to current `getMachineFingerprint()`) | High |
| Backup files are unencrypted SQL | `backups/*.dump` are world-readable to the install user | Offer optional symmetric encryption (`gpg --symmetric` or AES-GCM keyed by user-entered passphrase) | Medium |
| IPC payload validation | Boolean confirm flags on the destructive bridges; type-checks on activation payload; no JSON-schema validation otherwise | Add a small Zod/Joi pass per IPC handler before any side effect | Medium |
| Updater URL is `https://example.com/...` | `electron-updater` will check that URL on startup and log 404s | Set the real CDN before shipping any installer | High |
| Bundled secrets in installer | None today; `LICENSE_RSA_PRIVATE_KEY_B64` is intentionally NOT bundled | Confirm in CI that no `.env` is included in `extraResources` | Medium |
| Prisma migration safety | Pre-migration `pg_dump` is best-effort and currently silently skipped if `pg_dump` is missing | When desktop runtime is bundled, demote this to hard-fail so we never run an unbackup-able migration | Medium |
| Local Postgres process privilege | Postgres runs under whoever launched Electron | `perMachine: true` is set, but document that customers should not run installer with admin privileges they don't need | Low |
| `desktop-runtime/postgres/` is not git-ignored | Could be checked in by accident, bloating repo | Add `/desktop-runtime/` to `.gitignore` | Low |

---

## 14. Offline Capability

**Implemented / scaffolded**

- Local Postgres + backend startup
- Local React bundle served via `file://`
- Local license persistence (`license.json`)
- Local backup/restore IPC
- Local owner provisioning (`/auth/owner/setup`)
- Activation gate UI + entitlement banner

**Still missing**

| Item | Why it matters |
|---|---|
| Bundled PostgreSQL binaries | Without these the installed app can't start — `PG_RUNTIME_MISSING` error window. |
| End-to-end clean-VM install test | We have no observed evidence that the orchestrator survives in a real packaged install. |
| Business module offline smoke tests | None of `sales / stock / fnb / wholesale / reports / printing` has been exercised against the local backend. |
| `cloudHostingActive` / `updatesActive` enforcement | The banner is read-only — no code actively disables cloud-sync or auto-update download when entitlements are false. |
| License-token wiring into the renderer's axios client | `license.json` contains `licenseToken`; the desktop renderer doesn't yet seed `useLicenseStore` from it, so any future non-public route enforcement won't work offline. |
| Dexie offline-queue interaction | The pre-existing Dexie queue (frontend offline mode) still lives in `frontend/src/offline/`. It's now redundant in pure-desktop mode but has not been disabled — and may cause double-write surprises if it tries to flush against the local backend. |

---

## 15. Build / Test Status

| Check | Status | Evidence |
|---|---|---|
| Backend `tsc --noEmit` | **3 pre-existing errors** in `backend/src/saas/saas-plans.service.ts` (lines 57‑59). No errors in the desktop scaffolding. | Verified in this session. |
| Frontend `tsc --noEmit` (`tsconfig.app.json`) | **Clean** | Verified in this session. |
| `jest desktop-owner` | **12/12 pass** in 38.6 s | Run in this session. |
| `npm run build` (backend) | Not run. Will fail because of the 3 pre-existing errors (unless `tsc` is invoked through `nest build` which ignores type errors per config). | Recommend verifying before installer build. |
| `npm run electron:build` (frontend) | Not run in this session. | |
| `npm run desktop:dist:win` | Not run in this session. A stale `dist/Nezhin POS-Setup-1.0.0.exe` from 2026-05-14 exists; it predates all the desktop scaffolding work and is unsafe to ship. | |
| Clean Windows VM install test | **Not done.** | No evidence in repo or notes. |

---

## 16. Missing Items / 17. Recommended Next Steps

Listed in execution order.

| # | Step | Purpose | Files affected | Risk | Done when |
|---|---|---|---|---|---|
| 1 | Fix `saas/saas-plans.service.ts:57‑59` `null` vs `undefined` errors | Unblock backend `tsc --noEmit` for CI gate; same Prisma typing quirk that constrains the desktop service today | `backend/src/saas/saas-plans.service.ts`, optionally `prisma generate` against current schema | Touching SaaS plan creation behavior — keep semantics identical (`null` → unlimited) | `tsc --noEmit` is clean |
| 2 | Drop PostgreSQL Windows x64 binaries into `desktop-runtime/postgres/bin/` | The installed app cannot start without them | New `desktop-runtime/` tree; add `/desktop-runtime/` to `.gitignore`; update CI to fetch the runtime before `desktop:dist:win` | License compliance for the chosen Postgres build; installer size | A fresh install on a clean VM brings Postgres up on 127.0.0.1:55432 |
| 3 | Wire renderer to send `X-License-Token` from `license.json` in desktop | Future-proof: if any backend route stops being public-prefixed, the desktop still works | `frontend/src/stores/license-store.ts`, `DesktopActivationGate` boot effect | Low | `useLicenseStore.token` is populated post-activation in Electron |
| 4 | Enforce entitlement flags actively (not just banners) | The banner is informational only; auto-update should hard-stop when `updatesActive=false`, cloud sync code paths should refuse when `cloudHostingActive=false` | `frontend/src/components/electron/ElectronUpdaterProvider.tsx`, any cloud-sync caller, possibly `update-manager.cjs` | If wrong, paying customers see "expired" prematurely | An expired entitlement disables the corresponding feature path |
| 5 | Disable the Dexie offline queue when `IS_DESKTOP_APP` | Avoid double writes between the offline queue and the local backend | `frontend/src/offline/*` callers | Could surprise queued operations from a prior install/upgrade — add a one-shot flush step | No Dexie writes occur in desktop runtime |
| 6 | Replace updater placeholder URL | Avoid 404 noise + enable real auto-updates | `frontend/package.json` `build.publish.url` | None functional | A packaged build hits a real generic-feed URL |
| 7 | Wire `electronDesktopBackup.exportBackup()` into Settings | Customer-facing backup access (UI exists nowhere today) | `frontend/src/pages/SettingsPage.tsx` (or equivalent) | None | Button triggers backup, success/error surfaces in UI |
| 8 | Build the installer fresh (`npm run desktop:dist:win`) | Produce a shippable artifact that contains the new code | `dist/Nezhin POS-Setup-1.0.0.exe` | Pre-existing TS errors may block `nest build` depending on local tsconfig; resolve #1 first | A newly-dated `.exe` exists |
| 9 | Install on a clean Windows VM | First end-to-end confirmation | Whole installer | This is where we expect to find the most bugs | App boots, Postgres starts on 127.0.0.1:55432, `/health` responds, activation gate renders |
| 10 | Run the manual test checklist in `frontend/electron/DESKTOP_PACKAGING.md` | Cover activation, owner setup, offline login, sales/stock/print, backup, restore, restart persistence, expired entitlement states, HYBRID rejection | n/a — test execution | Each step uncovers concrete bugs to file | Every checklist row passes |

---

## 18. Final Readiness Assessment

**Verdict: Desktop scaffold implemented — internal-alpha at best, not production-ready.**

Why "alpha-tier":

| Reason | Detail |
|---|---|
| Local services are wired but never end-to-end exercised | No clean-VM install run has happened — `desktop-runtime/postgres/` doesn't exist locally. |
| Owner provisioning is implemented and unit-tested | `/auth/owner/setup` + 12 passing unit tests cover the spec. Integration coverage requires the full stack. |
| Backend has known pre-existing TS errors | 3 errors in `saas-plans.service.ts`. They block `tsc --noEmit` cleanliness but may or may not block `nest build`. |
| The on-disk installer is a month old | `dist/Nezhin POS-Setup-1.0.0.exe` (2026-05-14) predates everything in this report. It must not be shipped as-is. |
| Updater URL is a placeholder | `https://example.com/...` |
| Entitlement flags are informational only | Expired states show banners but do not disable cloud sync or auto-update flows. |
| Backups are unencrypted SQL on disk | Acceptable for alpha, not for retail customers. |

What it would take to move to "internal beta":

- Steps 1–6 in §17 done
- Fresh installer built and installed on at least one clean Windows VM
- Manual checklist in `DESKTOP_PACKAGING.md` executed once

What it would take to move to "production-ready":

- All of the above
- At least one paying tenant successfully running for 7 days offline after a fresh install
- A documented rollback path for failed Prisma migrations on a live customer machine
- Backup encryption (or an explicit acknowledgment that customers must encrypt the `backups/` folder themselves)
