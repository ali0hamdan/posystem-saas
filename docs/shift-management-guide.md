# Shift Management Guide

Shifts help you group **sales** and **cash movements** by work session and **branch**. This app exposes shift data through the **API** and **reports**; day-to-day “open register / close register” may be part of your internal procedure even if every button is not on one screen.

## Who can work with shifts?

| Capability | OWNER | ADMIN | CASHIER |
|------------|:-----:|:-----:|:-------:|
| API: open / close / list shifts (per branch) | ✓ | ✓ | ✓ |
| View **Shift closing** report | ✓ | ✓ | ✗ |

> **Note:** The web UI highlights shifts mainly under **Reports → Shift closing**. If your deployment adds a dedicated “Shift” page later, the same rules apply: pick the correct **branch** in the header first.

## Concepts

- **Branch context** — Shifts are tied to the branch selected via **X-Branch-Id** / branch picker. Wrong branch = wrong shift bucket.
- **Open shift** — Accepts new sales attributed to that shift (server rules apply).
- **Closed shift** — Locked for reconciliation; used in reporting.

## Reporting: Shift closing (`/reports`)

1. Sign in as **OWNER** or **ADMIN**.
2. Open **Reports** (`/reports`).
3. Choose **Shift closing** (shift-closing report).
4. Set **date range** (and any filters your build exposes, e.g. branch-related params).
5. Export or print if your report toolbar offers **XLSX / PDF / Print**.

**What you are looking for**

- **Net sales** attributed to shifts in the window.
- **Cash variance** (if your configuration fills it)—investigate large gaps before banking.

## Operational best practices

- **Open** at the start of a drawer session; **close** before counting cash to the safe.
- One **lead cashier** per register reduces duplicate open shifts (depends on API usage).
- If a shift cannot close, read the error—often an **unresolved sale** or **permission** issue.

## Common mistakes

- Running reports with the **wrong branch** selected—numbers will not match the physical drawer.
- Expecting shift UI on the dashboard—your build may rely on **Reports** and/or integrations using the REST API (`/shifts/open`, `/shifts/close`, `/shifts/current`).

## Short example: nightly review

1. Manager selects branch **“Front counter”**.
2. `/reports` → **Shift closing** → yesterday’s date range.
3. Export PDF for accounting.
4. File with the counted cash envelope.

## Related guides

- [Sales and Refunds](./sales-and-refunds-guide.md)
- [Reports](./reports-guide.md)
