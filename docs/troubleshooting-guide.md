# Troubleshooting Guide

Friendly fixes for the most common Stock POS issues. When in doubt, capture the **time**, **branch**, and **support ref** (if the app shows one after an error).

## Sign-in and session

| Symptom | Things to try |
|---------|----------------|
| **Invalid username or password** | Caps Lock; reset password via admin (`/users`); verify user **active**. |
| **Kicked to login** after idle | Session/JWT expired—sign in again. |
| **429 Too Many Requests** | Wait a minute; too many rapid attempts (login is rate limited per IP). |

## License (when enabled)

| Symptom | Fix |
|---------|-----|
| Stuck on **Activate** | Enter a valid activation code; ensure device has internet once. |
| **License** errors after login | Visit `/license`; admin checks `/license-admin` for device limits / expiry. |
| Dev workstations | Developers can use `BYPASS_LICENSE` / `VITE_BYPASS_LICENSE` flags—**never** in real production. |

## Branch and permissions

| Symptom | Fix |
|---------|-----|
| “No access to branch” | Header branch picker → choose an assigned branch; admin verifies **user ↔ branch** links. |
| Missing menu pages | Your **role** may hide them—compare with [docs/README](./README.md) role table. |

## POS and payments

| Symptom | Fix |
|---------|-----|
| **Cannot complete sale** | Read the toast: often stock, customer required, or offline credit restriction. |
| Offline but need **credit** | Pay full amount with cash/card while offline, or reconnect. |
| Barcode finds wrong item | Clean scanner lens; verify SKU uniqueness in **Products**. |

## Inventory mismatches

1. `/products` → confirm on-hand.
2. `/stock-movements` for recent adjustments.
3. `/stock-transfers` if goods moved branches.
4. `/offline-queue` if offline sales rolled stock locally.

## Reports empty or “wrong”

- Check **date range** and **branch** header.
- Refresh after long idle.
- Admins only: verify `/reports` access.

## CORS / API URL (self-hosted)

| Symptom | Fix |
|---------|-----|
| Browser console CORS errors | API `CORS_ORIGIN` must list the **exact** SPA origin (scheme + host + port). |
| API calls go to localhost in prod | Rebuild frontend with correct **`VITE_API_URL`**. |

## Database / deploy

| Symptom | Fix |
|---------|-----|
| Prisma / migration errors on boot | Run `npx prisma migrate deploy` against the right `DATABASE_URL`. |
| 500 errors everywhere | Check API logs; database down; wrong `JWT_SECRET` after rotate forces re-login—not a bug. |

## Desktop (Electron)

| Symptom | Fix |
|---------|-----|
| Silent print fails | Printer online; correct device in `/settings`; use **Export logs** (desktop section) for support. |
| Updates stuck | Finish active sale; sync offline queue; retry restart from the update banner. |

## Still stuck?

1. Note **user role**, **branch**, **page URL**, and **approximate time**.
2. If an error shows **support ref**, include it in your ticket.
3. For self-hosted installs, include **API version / git tag** and **browser version**.

## Related guides

- [Backup and Restore](./backup-and-restore-guide.md)
- [Deployment notes](../DEPLOYMENT.md)
