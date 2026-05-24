# Customer Debt Guide

“Debt” here means a **customer account balance** (money the customer owes, or store credit—your accounting team defines the sign convention). POS may use **CREDIT** payments against that balance.

## Who can do what?

| Action | OWNER | ADMIN | CASHIER |
|--------|:-----:|:-----:|:-------:|
| View customer list | ✓ | ✓ | ✓ |
| Open customer profile | ✓ | ✓ | ✓ |
| Adjust balance / ledger (if UI exposed) | ✓ | ✓ | varies |

> Cashiers can **attach** customers to sales when required; changing balances is usually a **manager** task.

## Customers list (`/customers`)

1. Search by name, phone, or identifier your store uses.
2. Click a row to open **Customer detail** (`/customers/:id`).

## Customer detail (`/customers/:id`)

Typical sections (wording may match your build):

- **Profile** — contact info, notes.
- **Balance** — running debt/credit.
- **Ledger / history** — audit-friendly list of movements (when enabled).

## Adjusting balance (managers)

If your deployment includes **Adjust balance** (modal):

1. Open the customer.
2. **Adjust balance**.
3. Enter **amount** (positive or negative per your policy), **reason** (required in many stores), optional **note**.
4. Save; the list and POS should reflect the new balance after refresh.

**Common mistakes**

- Adjusting without a **reason** → blocked or poor audit trail.
- Confusing **store credit** vs **AR**—train staff on your sign convention.

## POS: using customer credit

1. On `/pos`, attach the **customer** before choosing **CREDIT** or partial payments that require a customer.
2. If offline, **credit** sales may be **blocked**—take cash/card or reconnect.

## Short example: pay down debt with cash in store

1. `/customers` → find “Maria Lopez”.
2. Open profile → **Adjust balance** with reason “Cash payment on account” and amount per policy.
3. Save; give Maria a printed receipt from your office workflow.

## Related guides

- [Sales and Refunds](./sales-and-refunds-guide.md)
- [Troubleshooting](./troubleshooting-guide.md)
