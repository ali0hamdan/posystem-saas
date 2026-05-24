# Stock POS — frontend (Vite + React)

This package is the **operator UI** for Stock POS. API calls go to **`VITE_API_URL`** (see `src/lib/env.ts`).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server (default port **5173**) |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Preview the production build |
| `npm run electron:dev` | Desktop shell + Vite (see `electron/`) |
| `npm run electron:dist` | Packaged desktop installers |

## Documentation

- **User & operator manuals:** [`../docs/README.md`](../docs/README.md)  
- **Developer overview & monorepo scripts:** [`../README.md`](../README.md)  
- **Install & deploy:** [`../INSTALLATION.md`](../INSTALLATION.md), [`../DEPLOYMENT.md`](../DEPLOYMENT.md)  

## Environment

Copy `.env.example` to `.env` or `.env.local`. Never commit real secrets.
