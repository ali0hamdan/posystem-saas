# Sales and Refunds Guide

Covers **POS checkout** and **refunds** from history.

## Roles

| Action | OWNER | ADMIN | CASHIER |
|--------|:-----:|:-----:|:-------:|
| Sell on POS | ✓ | ✓ | ✓ |
| View sales history | ✓ | ✓ | ✓ |
| Issue refund / partial refund | ✓ | ✓ | ✗ |

## POS sales (`/pos`)

See also: [Cashier User Guide](./cashier-user-guide.md) for step-by-step checkout.

**Managers should know**

- **Tax** may auto-calculate from store settings—verify on a test sale before go-live.
- **Mixed payments** split card/cash/credit; partial credit sales may require **customer** + online server.

## Sales history (`/sales`)

1. Filter by **date range**, **cashier**, **payment status**, or **sale status**.
2. Open the **eye** icon (view) to inspect line items and payments.
3. Use pagination to walk older days.

## Refunds (OWNER / ADMIN)

**Page:** `/sales` (same list; refund action from sale detail / modal).

**Typical partial refund**

1. Locate the sale (date + invoice helps).
2. Open **details**.
3. Choose **Refund** (wording may vary).
4. Enter **quantities per line** or choose **full refund** when offered.
5. Confirm; note the new **refunded / partially refunded** status.

**Common mistakes**

- Refunding the **wrong duplicate sale** (similar totals)—always verify **invoice number** and **timestamp**.
- Refunding more **quantity** than sold—UI/API should block; if not, stop and contact support.

## Offline sales

- When the device is offline, sales may be **queued** locally.
- After reconnect, the **Offline sync** page (`/offline-queue`) shows pending rows—an admin should monitor failures.

## Short example: return 1 of 3 items

1. `/sales` → filter customer name or invoice `INV-1042`.
2. Open sale → **Refund**.
3. Reduce line “T-shirt” from 3 → refund qty **1**.
4. Submit; customer receives payment back per store policy.

## Related guides

- [Customer Debt](./customer-debt-guide.md) — credit balances and adjustments.
- [Shift Management](./shift-management-guide.md) — how sales roll into shift reports.
