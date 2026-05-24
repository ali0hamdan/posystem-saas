# Purchase Orders Guide

For **OWNER** and **ADMIN**. Purchase orders (POs) track **buying from suppliers** and receiving stock.

## Page

**Purchase orders:** `/purchases`  
**Suppliers:** `/suppliers`

## Recommended flow

### 1. Maintain suppliers (`/suppliers`)

1. Add supplier legal name, contact, and payment terms you care about.
2. Deactivate suppliers you no longer use (if your UI supports it).

### 2. Create a PO (`/purchases`)

1. **New purchase order**.
2. Pick **supplier** and **expected date** (if available).
3. Add **lines**: product, quantity, unit cost.
4. Save as **draft** until the vendor confirms.

### 3. Receive goods

When stock arrives:

1. Open the PO.
2. Use **receive** / **mark received** actions (wording varies) line by line or in bulk.
3. Confirm **quantities actually received**—partial shipments are common.

**Common mistakes**

- Receiving against the **wrong branch** header—inventory lands in the wrong store.
- Wrong **unit cost**—skews inventory valuation reports.

## Roles

| Action | OWNER | ADMIN | CASHIER |
|--------|:-----:|:-----:|:-------:|
| Manage suppliers / POs | ✓ | ✓ | ✗ |

## Short example: reorder bottled water

1. `/suppliers` → verify “City Beverages” exists.
2. `/purchases` → **New** → supplier City Beverages.
3. Line: SKU `WATER-1L`, qty 120, cost per case.
4. Submit to **draft** → email PDF to vendor (outside the app).
5. On delivery day, open PO → **Receive 120** → stock increases.

## Related guides

- [Inventory Management](./inventory-management-guide.md)
- [Reports](./reports-guide.md)
