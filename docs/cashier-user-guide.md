# Cashier User Guide

For **CASHIER** (and anyone ringing sales). Your sidebar may be shorter than an admin’s—that is normal.

## Before you open the register

1. **Sign in** at `/login`.
2. Confirm **branch** in the header (e.g. “Main store” vs “Warehouse outlet”).
3. Go to **Point of sale** (`/pos`).

## Selling on the POS (`/pos`)

### Add items

1. Click in the **search** box (or scan a barcode if your store uses scanners).
2. Type a few letters of the product name **or** scan/type the full **SKU / barcode** for a quick match.
3. Adjust **quantity** with `+` / `−` or edit the number.
4. Apply **line discount** or **global discount** only if your store allows it.

**Shortcuts (if enabled in your browser)**

- **F2** — focus search (common POS flow).
- **Ctrl+Enter** — submit sale when the cart is valid (when not blocked by validation).

### Payments

- Choose **Cash**, **Card**, **Credit**, or **Mixed** as your store uses them.
- For **cash**, enter amount received; change appears when applicable.
- **Customer credit** and unpaid remainders usually require a **selected customer** and a live connection—follow on-screen messages.

### Finish the sale

1. Press **Complete sale** (or your store’s equivalent button).
2. If **receipt auto-print** is on (Electron + thermal), the receipt may print automatically.
3. Otherwise use **Print** or **Email** from the receipt preview if shown.

**Common mistakes**

- Cart shows **stock warning** but still lets you sell—fix quantities if your manager requires it.
- **Offline mode**: you cannot rely on customer **credit** the same way as online; pay in full with cash/card when prompted.
- Forgetting to select **customer** when the total is not fully covered by non-credit payments.

## Sales history (read-only for you)

**Page:** `/sales`

- Search by date or filters your admin enabled.
- Open a sale to **view details**; **refunds** are usually **admin/owner only**.

## Customers

**Pages:** `/customers`, `/customers/:id`

- Search customers before attaching to a sale on the POS.
- **Balance / debt** may be visible; adjusting balance is typically **admin/owner**—see [Customer Debt Guide](./customer-debt-guide.md).

## Branches

**Page:** `/branches`

- You can often **see** branches you are assigned to; creating or editing branches is **owner** work.

## When the internet drops

- The app may save sales **offline** and queue them.
- Tell a supervisor to open **Offline sync** (`/offline-queue`) if sales are stuck—cashiers may not have that menu.

## Short example: simple cash sale

1. `/pos` → search “bottled water”.
2. Add line, qty 2.
3. Payment **Cash**, enter amount received.
4. Complete sale → give change → next customer.

## Related guides

- [Sales and Refunds Guide](./sales-and-refunds-guide.md) — managers handle refunds here.
- [Troubleshooting](./troubleshooting-guide.md) — “cannot sign in”, “offline”, etc.
