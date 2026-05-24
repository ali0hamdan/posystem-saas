# Deployment and operations

This document complements **[README.md](./README.md)** and **[INSTALLATION.md](./INSTALLATION.md)** for running Stock POS in production. **End-user guides** (POS, refunds, reports, printers, backups, troubleshooting) live under **[`docs/`](./docs/README.md)**.

## Architecture (typical)

1. **PostgreSQL** — primary data store.
2. **NestJS API** — Node process on `PORT` (default `3000`), stateless; scales horizontally behind a load balancer.
3. **Static frontend** — Vite build output (`frontend/dist`) served by nginx/Caddy/S3+CloudFront or similar.
4. **TLS** — terminate HTTPS at the reverse proxy or CDN.

Set the SPA **`VITE_API_URL`** at **build time** to the public API base URL (no trailing slash).

## Reverse proxy

- Forward `Host`, `X-Forwarded-For`, `X-Forwarded-Proto` (or equivalent) so the API sees correct host and client IP.
- Set **`TRUST_PROXY=1`** (or `true`) on the API in production when it sits behind that proxy so Express trusts `X-Forwarded-*` and rate limiting uses the real client IP.

### Example: nginx → Node

```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Environment (production)

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | Listen port inside the container/VM |
| `DATABASE_URL` | PostgreSQL URL with TLS params if required (`?sslmode=require`, etc.) |
| `JWT_SECRET` | ≥48 chars, high entropy; rotate by forcing re-login after deploy if you change it |
| `CORS_ORIGIN` | Exact frontend origins, comma-separated |
| `TRUST_PROXY` | `1` behind a trusted proxy |
| `THROTTLE_LIMIT` / `THROTTLE_TTL_MS` | Optional tuning |
| `SENTRY_DSN` | Optional API error monitoring (see `backend/.env.example`) |
| `LOG_LEVEL` | Optional Pino log level (`info`, `warn`, …) |

When building the SPA, set **`VITE_SENTRY_DSN`** only if you want browser error reporting (never commit secrets).

## Database migrations

On each release, run against the target database:

```bash
cd backend
npx prisma migrate deploy
```

Run migrations **before** or **as part of** rolling out the new API binary. Avoid running old code against a newer schema for long.

## PostgreSQL backups

### Logical dump (recommended for restores and portability)

```bash
# Custom compressed format (includes schema + data)
pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%Y%m%d-%H%M).dump
```

Restore (creates objects; use a clean DB or adjust):

```bash
pg_restore --clean --if-exists -d "$DATABASE_URL" backup-YYYYMMDD-HHMM.dump
```

### Plain SQL

```bash
pg_dump "$DATABASE_URL" --no-owner --no-acl -f backup.sql
```

### Automation

- Schedule **`pg_dump`** via cron, systemd timer, or your cloud provider’s managed backup feature.
- Store dumps off-server (encrypted object storage).
- Periodically **test restores** on a staging instance.

### Point-in-time recovery (PITR)

For enterprise RPO/RTO, enable **WAL archiving** / **continuous archiving** or use a managed PostgreSQL service with PITR (RDS, Cloud SQL, Azure Database, etc.).

## Rolling out the frontend

```bash
cd frontend
VITE_API_URL=https://api.yourdomain.com npm run build
```

Deploy `dist/` to static hosting. Ensure **`CORS_ORIGIN`** on the API includes the exact browser origin of the SPA (scheme + host + port).

## Optional: Electron desktop POS

The `frontend/` package can produce a packaged desktop app (`npm run electron:dist`). Typical rollout:

1. Build the **same** web assets with the production **`VITE_API_URL`**.
2. Host **auto-update** artifacts (`latest.yml` + installers) on HTTPS per `frontend/package.json` → `build.publish`.
3. Distribute the installer; operators follow **[Printer Setup](./docs/printer-setup-guide.md)** for thermal drivers.

## Health check

`GET /health` returns JSON `{ "status": "ok", ... }`. It is excluded from the default rate limiter (`@SkipThrottle()`). Use this for load balancer health checks.

## Security headers and CORS

- **Helmet** is enabled with API-friendly settings (CSP disabled for JSON API; HSTS enabled in production).
- **CORS** is strict in production: wildcard `*` is rejected by configuration validation.

## Process manager

Use **systemd**, **PM2**, **Docker**, or Kubernetes to restart the API on failure and on reboot. Example:

```bash
NODE_ENV=production PORT=3000 node backend/dist/main.js
```

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| 429 Too Many Requests | Lower traffic or raise `THROTTLE_LIMIT`; login is capped at 5 attempts/min per IP regardless |
| CORS errors in browser | `CORS_ORIGIN` must list the SPA origin exactly |
| Wrong client IP in logs / throttles | Set `TRUST_PROXY=1` behind reverse proxy |
