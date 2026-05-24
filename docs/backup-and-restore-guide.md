# Backup and Restore Guide

Stock POS stores business data in **PostgreSQL**. The SPA and API do not replace a proper database backup strategy.

## What to back up

| Item | Why |
|------|-----|
| **PostgreSQL** | All sales, inventory, users, settings, audit logs |
| **Environment files** (secure store) | `JWT_SECRET`, `DATABASE_URL`, license keys—not in git |
| **Frontend build config** | Record which **`VITE_API_URL`** you used for each release |

## Recommended backup: logical dump

From any machine with `pg_dump` installed and network access to the DB:

```bash
pg_dump "$DATABASE_URL" -Fc -f stock-pos-$(date +%Y%m%d-%H%M).dump
```

- **`-Fc`** = custom compressed format (good for `pg_restore`).

### Automated schedules

- Nightly **cron**, **Task Scheduler**, or your cloud’s **managed backup**.
- Store files **off-server** with encryption (S3 Glacier, Azure Blob, etc.).
- **Test restore** quarterly on a staging database.

## Restore (replace or new database)

> Restoring with `--clean` drops objects that clash. Practice on **staging** first.

```bash
pg_restore --clean --if-exists -d "$DATABASE_URL" stock-pos-YYYYMMDD-HHMM.dump
```

Then:

1. Run **migrations** if the dump is older than the schema:

   ```bash
   cd backend
   npx prisma migrate deploy
   ```

2. Redeploy matching **API + frontend** versions.
3. Smoke test: login, one sale, one report.

## File-level “backup” of the app

- The **code** lives in git tags/releases.
- The **database** is the source of truth—copying `frontend/dist` alone is **not** a business backup.

## Offline POS devices (browser IndexedDB)

- Some browsers queue **offline sales** locally.
- If a workstation dies before sync, data can be lost—train staff to open **Offline sync** (`/offline-queue`) when back online.

## Common mistakes

- Only backing up the **VM disk** without logical dumps—corruption can still lose data.
- Restoring a **production** dump into **production** without a maintenance window plan.

## Short example: nightly 02:00 backup

1. Server cron runs `pg_dump` to `/secure/backups/pos/`.
2. Cloud sync copies the folder to encrypted object storage.
3. Monday morning, IT opens latest file size to confirm non-zero growth.

## Related reading

- Repository **[DEPLOYMENT.md](../DEPLOYMENT.md)** — longer operations notes.
- [Troubleshooting](./troubleshooting-guide.md)
