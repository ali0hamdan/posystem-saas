# Reports Guide

For **OWNER** and **ADMIN**. Reports live under **`/reports`** with a hub layout: pick a report, set filters, then export or print.

## Getting started

1. Sign in with an admin-capable account.
2. Open **Reports** (`/reports`).
3. Choose a report tile (each describes what it contains).
4. Set **date range** and any **branch / cashier / category** filters your build exposes.
5. Use toolbar actions: **Refresh**, **Export XLSX**, **PDF**, or **Print** (depending on report).

## Report families (examples)

Your build may label these slightly differently; look for similar wording:

| Report idea | Typical use |
|-------------|-------------|
| **Sales summary / detail** | Daily sales audit, category mix |
| **Inventory / stock valuation** | Month-end counts, dead stock |
| **Shift closing** | Drawer reconciliation, cashier variance |
| **Commercial / financial** | Management KPIs (as enabled) |

## Roles

| Access | OWNER | ADMIN | CASHIER |
|--------|:-----:|:-----:|:-------:|
| `/reports` | ✓ | ✓ | ✗ |

## Common mistakes

- Forgetting to change the **branch** in the header before running branch-specific analytics.
- Exporting **huge** date ranges—start with a week to verify columns, then widen.
- Mixing **invoice date** vs **paid date** semantics—read the report subtitle/help text.

## Short example: weekly owner review

1. `/reports` → pick **Sales** (or closest match).
2. Dates: last Monday → last Sunday.
3. Export **XLSX** → attach to weekly operations email.

## Related guides

- [Shift Management](./shift-management-guide.md)
- [Backup and Restore](./backup-and-restore-guide.md) — protect the database that feeds these numbers.
