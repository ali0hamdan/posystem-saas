# Nezhin POS — Test & Security Report

_Prepared automatically against the `stock-managment` repository (NestJS API + React/Vite/Electron frontend)._

## Scope

You asked for heavy testing across four areas. Here is what was set up and what was actually executed:

| Area | Status | Executed here? |
|---|---|---|
| Unit / integration (backend) | **50/50 tests passing** | ✅ Yes, run in sandbox |
| Security audit (backend) | Static review complete (SAST + config) | ✅ Yes (no live server, so no DAST) |
| Load / stress (k6) | Scripts authored, ready to run | ⚠️ Needs a running API + k6 |
| End-to-end / UI (Playwright) | Specs + config authored, ready to run | ⚠️ Needs running app + Playwright install |

---

## 1. Backend unit / integration tests

The project had **one** test file (`tenant-isolation.spec.ts`). I added three more, all passing, run with `ts-jest`:

```
Test Suites: 4 passed, 4 total
Tests:       50 passed, 50 total
```

New files in `backend/src/__tests__/`:

- **`sales-pricing.spec.ts`** (22 tests) — the money math: line/global discounts, discount capping, percentage tax vs manual tax, credit-vs-real-money payment status, full vs proportional refund amounts, sale date-range validation, and the `create()` guards (empty cart, missing customer, unknown product, insufficient stock, credit-requires-customer).
- **`stock-adjustment.spec.ts`** (10 tests) — `StockService` adjustments: branch/product/stock-row not-found guards, zero-quantity and empty-reason rejection, the insufficient-stock rule, the `allowNegativeStock` override, and correct before/after quantity math on the recorded stock movement.
- **`auth-service.spec.ts`** (7 tests) — login: unknown user, locked account, wrong password below threshold, the 5th-attempt lockout, successful token issuance, and store disambiguation by `clientSlug`. (`bcrypt` is mocked so the native binding isn't required.)

**Run it:**
```bash
cd backend
npm test                 # uses the project's jest.config.ts
# or with coverage:
npm run test:cov
```

---

## 2. Security audit (static)

This codebase is **well-secured**. The architecture follows current NestJS security practice.

**Strengths confirmed**
- `helmet` with a strict production CSP, HSTS, frameguard `deny`, `x-powered-by` disabled.
- CORS is locked down in production — the app refuses to boot with a wildcard origin when `NODE_ENV=production`.
- Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted` + `transform`, plus a global HTML-sanitizing interceptor on all string inputs.
- **Multi-tenant isolation** is enforced consistently: every tenant-scoped query carries `clientId` in the `WHERE` clause (and there's a dedicated test suite proving cross-tenant reads/writes 404).
- JWT strategy re-validates the user on every request (active status, `clientId` match, token `typ` — store-user vs saas-admin can't be swapped).
- Role-based access via `RolesGuard`; route-level role gating in the frontend router too.
- **Account lockout**: 5 failed attempts → 15-minute lock, with audit-logged login events.
- Passwords hashed with bcrypt; refresh tokens hashed and rotated on use/logout.
- All raw SQL uses Prisma's parameterized `Prisma.sql` tagged templates (no string concatenation) and is tenant-scoped — no SQL-injection surface found.
- Robust `Joi` env validation: production requires `JWT_SECRET` ≥ 48 chars and rejects the dev placeholder, requires a separate `SAAS_JWT_SECRET`, non-wildcard CORS, and RSA license keys.

**Findings / recommendations**

| # | Severity | Finding | Recommendation |
|---|---|---|---|
| 1 | **Medium** (perf/DoS) | `AuthService.refresh()` loads **all** users that have a refresh token and `bcrypt.compare()`s the supplied token against each one (O(n) bcrypt per refresh). Under load or with many users this is a CPU-exhaustion / latency vector. | Use a selector/verifier pattern: store an indexed random `tokenId` alongside the hash (or put a token id in the refresh JWT), look the row up directly, then compare once. |
| 2 | Low | A single `refreshTokenHash` per user means only one active session/device; signing in elsewhere silently invalidates the previous session. | If multi-device is desired, move refresh tokens to their own table keyed by device. |
| 3 | Low / Info | `backend/.env` holds a weak placeholder `JWT_SECRET`, a DB password, and a base64 RSA **private** key. It is **gitignored and not committed** (verified), and prod validation blocks weak secrets — so this is dev-only. | Never reuse these dev values in production; rotate the demo RSA key if it was ever real. Note the repo lives under OneDrive — avoid cloud-syncing real secrets. |
| 4 | Info | `refresh()` also issues a redundant initial `findFirst` before the `findMany` scan. | Minor cleanup; folds into fix #1. |

> Note: this is a static review. A dynamic scan (OWASP ZAP against a running instance) and a dependency audit (`npm audit`) are worthwhile complements — see section 5.

---

## 3. Load / stress tests (k6)

`loadtest/load-test.js` targets the API with four selectable profiles and pass/fail thresholds (p95 < 800ms, <1% transport errors). It logs in, then exercises `/health` and `/products`.

**Install k6:** https://k6.io/docs/get-started/installation/

```bash
# from the repo root, with the API running:
k6 run -e SCENARIO=smoke  -e BASE_URL=http://localhost:3000 \
  -e USERNAME=owner -e PASSWORD='YourPass' -e CLIENT_SLUG=your-store \
  -e BRANCH_ID=<branchId> loadtest/load-test.js

k6 run -e SCENARIO=load   ...   # ramp to 50 VUs
k6 run -e SCENARIO=stress ...   # ramp 100→200→400 VUs (find the ceiling)
k6 run -e SCENARIO=spike  ...   # sudden 300-VU burst
```

⚠️ Run load tests only against a machine you control (your local/staging box), never production.
Tip: refresh is bcrypt-bound (see finding #1) — if you load-test token refresh specifically, expect that endpoint to be your bottleneck.

---

## 4. End-to-end / UI tests (Playwright)

`frontend/playwright.config.ts` + `frontend/e2e/*.spec.ts`. Specs cover: login form rendering, empty-submit validation, invalid-credential error, the authenticated login→dashboard happy path (auto-skips unless creds are provided), public landing load, protected-route redirect, and a console-error check on the landing page.

```bash
cd frontend
npm i -D @playwright/test
npx playwright install
# backend API must be running and reachable (VITE_API_URL); Vite is auto-started.
E2E_USERNAME=owner E2E_PASSWORD='YourPass' E2E_CLIENT_SLUG=your-store \
  npx playwright test
npx playwright test --ui      # interactive mode
```

---

## 5. Suggested next steps

1. Apply fix #1 (refresh-token lookup) — it's the one real correctness/scaling issue.
2. Run `npm audit` in both `backend/` and `frontend/` for dependency CVEs.
3. Run an OWASP ZAP baseline scan against a running staging instance for dynamic coverage.
4. Wire `npm test` + Playwright into CI so regressions are caught automatically.
5. Expand unit coverage to the remaining services (reports, purchase-orders, shifts, license) using the same mocked-Prisma pattern.

---

## Environment notes

The sandbox used here is low-memory and the repo is on a OneDrive-synced path, so the test runner needed `--maxWorkers=1` and a capped heap. On your Windows machine the standard `npm test` works directly. The native `bcrypt` binary is Windows-built, which is why `auth.service` tests mock `bcrypt` rather than loading it.
