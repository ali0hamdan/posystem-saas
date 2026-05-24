# Inventory Management Guide

For **OWNER** and **ADMIN** (cashiers usually **view** products only).

## Products (`/products`)

### Add a product

1. Open **Products**.
2. **Add product** (or equivalent).
3. Fill **name**, **SKU/barcode** (if used), **category**, **price**, **stock** (or receive stock later via purchase/adjustment—follow your store policy).
4. Set **active** / **inactive** to hide discontinued items from POS search.
5. Save.

### Edit stock safely

- Prefer **documented flows**: purchase orders, stock movements, or transfers—so accounting can trace changes.
- **Direct quantity edits** (if your UI exposes them) should be reserved for corrections with a note.

**Common mistakes**

- Duplicate **SKU** or **barcode** causing scan mismatches.
- Setting **min stock** too low so low-stock alerts never fire.

## Categories (`/categories`)

1. Create parent categories first (e.g. “Beverages”).
2. Map products to categories for tidy POS search and reporting.

## Stock movements (`/stock-movements`)

Use for **adjustments**, **damage**, **counts**, etc., as implemented in your store.

**Typical pattern**

1. Open **Stock movements**.
2. Choose product and branch.
3. Enter **quantity change** and **reason** (when prompted).
4. Submit; verify on **Products** that on-hand matches reality.

## Stock transfers (`/stock-transfers`)

Move inventory **between branches**.

1. Open **Stock transfers**.
2. Choose **from branch** and **to branch** (must differ).
3. Add lines (product + quantity).
4. Submit; receiving branch confirms stock when your process says so.

**Common mistakes**

- Transferring more than available at source—the app should block; fix quantities and retry.
- Wrong **branch** selected in header—always check branch context.

## Product labels (`/product-labels`)

- Generate/print labels for **shelf** or **scanning**; match **paper size** to your printer.

## Roles

| Action | OWNER | ADMIN | CASHIER |
|--------|:-----:|:-----:|:-------:|
| View products | ✓ | ✓ | ✓ |
| Edit catalog / categories | ✓ | ✓ | ✗ |
| Stock movements / transfers | ✓ | ✓ | ✗ |

## Short example: weekly count correction

1. Count “Premium beans” physically: 8 bags.
2. System shows 10 → `/stock-movements` → adjustment **−2** with reason “cycle count 2026-05-14”.
3. Re-open product to confirm quantity 8.

## Related guides

- [Purchase Orders](./purchase-orders-guide.md)
- [Troubleshooting](./troubleshooting-guide.md)
