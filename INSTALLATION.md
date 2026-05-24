# Installation

Step-by-step setup for **development** and notes for **production** installs. Commands assume a POSIX shell (`bash`); on Windows use **PowerShell** equivalents or **Git Bash**.

## 1. Prerequisites

- **Node.js 18+** and **npm**
- **PostgreSQL 14+** (local instance or connection string from your host)
- **Git** (to clone the repository)

Optional:

- **Docker** (if you containerize later—not required by these steps)

## 2. Clone the repository

```bash
git clone <your-fork-or-mirror-url> stock-managment
cd stock-managment
```

## 3. Database

1. Create an empty database, e.g. `pos`.
2. Note the connection string, e.g.  
   `postgresql://USER:PASSWORD@localhost:5432/pos?schema=public`

## 4. Backend (API)

```bash
cd backend
cp .env.example .env
```

Edit **`backend/.env`**:

| Variable | Development | Production |
|----------|-------------|------------|
| `DATABASE_URL` | Your local DSN | Managed Postgres DSN (often `sslmode=require`) |
| `JWT_SECRET` | ≥32 chars | ≥48 chars, random |
| `NODE_ENV` | `development` | `production` |
| `CORS_ORIGIN` | `http://localhost:5173` or `*` (dev) | Exact HTTPS origins, comma-separated |
| `BYPASS_LICENSE` | `true` optional for local | `false` + RSA keys when licensing is on |
| `SENTRY_DSN` / `LOG_LEVEL` | Optional | Optional (see `.env.example`) |

Install and migrate:

```bash
npm install
npx prisma migrate deploy
npx prisma db seed   # dev/test data; see seed rules for production
npm run start:dev    # http://localhost:3000 by default
```

## 5. Frontend (SPA)

```bash
cd ../frontend
cp .env.example .env
```

Set **`VITE_API_URL`** if the API is not at `http://localhost:3000`.

```bash
npm install
npm run dev          # http://localhost:5173
```

## 6. First login (seeded dev)

After `prisma db seed` in **non-production**, use the seeded **owner** and **cashier** accounts documented in `backend/prisma/seed.ts` / console output.

> Production seeding requires `SEED_ADMIN_PASSWORD`—see `README.md`.

## 7. Optional: Electron desktop

From `frontend/` (after a successful web dev run):

```bash
npm run electron:dev
```

Requires the Vite dev server on **5173** unless you override `VITE_DEV_SERVER_URL`.

Packaging:

```bash
npm run electron:dist
```

Configure `build.publish` in `frontend/package.json` for your update server when you enable auto-updates.

## 8. Smoke test checklist

- [ ] Login as owner
- [ ] Create or verify a product
- [ ] Complete a **$0.01** test sale (void/refund per policy)
- [ ] Open **Reports** as admin
- [ ] `GET /health` returns OK

## See also

- **[README.md](./README.md)** — scripts and developer overview  
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — TLS, proxy, backups  
- **[docs/README.md](./docs/README.md)** — operator manuals  
