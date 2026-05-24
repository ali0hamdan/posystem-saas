# Admin User Guide

For **OWNER** and **ADMIN** roles. Admins often have the same menus as owners but may be limited when **creating users** (many stores restrict admins to **cashier** accounts only).

## First-time setup checklist

1. **License** (desktop or hosted): complete activation if your deployment uses licensing (`/activate`, then `/license`).
2. **Store settings** (`/settings`): store name, phone, address, tax, currency, receipt options.
3. **Branches** (`/branches`): confirm codes and active flags.
4. **Users** (`/users`): invite cashiers; set strong passwords.
5. **Products** (`/products`) and **Categories** (`/categories`): catalog before go-live.

## Daily operations

| Task | Page |
|------|------|
| Ring sales | `/pos` |
| Review day | `/dashboard`, `/sales` |
| Stock corrections | `/stock-movements` (adjustments as your workflow defines) |
| Move stock between branches | `/stock-transfers` |
| Refund / partial refund | `/sales` → sale detail / refund action |
| Reports | `/reports` |
| Purchase receiving | `/purchases` |
| Offline queue | `/offline-queue` |

## Users (`/users`)

**Typical steps**

1. Open **Users**.
2. **Add user** → choose role (ADMIN may only add **CASHIER** in some setups).
3. Set **username**, **display name**, **password**, optional **email**.
4. Save; share credentials through your company’s **secure channel** (not pasted in chat logs).

**Common mistakes**

- Reusing weak passwords.
- Forgetting to **assign the user to a branch** if your workflow requires branch membership (see Branches).

## Store settings (`/settings`)

- **Receipt** section: footer text, paper width (58/80 mm), optional **auto-print** on POS (often used with Electron + thermal printer).
- **Tax & currency**: enable tax only when accounting approves; currency is a 3-letter code (e.g. USD).
- **Logo URL** must be **https** if used.

## Branches (`/branches`)

- **Owner** creates/edits branches; codes are usually **unique** and uppercase.
- Cashiers **select** branch in the header for sales.

## Licensing (when enabled)

- **License status:** `/license`
- **Licensing admin:** `/license-admin` — activation codes, devices, renewals (OWNER/ADMIN).

## Product labels (`/product-labels`)

- Print shelf or barcode labels according to your template workflow.

## What admins cannot do (depends on configuration)

- Some actions are **owner-only** (e.g. certain branch or license operations). If a button is missing, ask an **OWNER**.

## Short example: add a cashier

1. `/users` → **Add user**.
2. Role **CASHIER**, username `tina.pos`, strong password.
3. Save → send password via your IT process.
4. Confirm Tina can open `/pos` after selecting the right branch.

## Related guides

- [Inventory Management](./inventory-management-guide.md)
- [Sales and Refunds](./sales-and-refunds-guide.md)
- [Reports](./reports-guide.md)
