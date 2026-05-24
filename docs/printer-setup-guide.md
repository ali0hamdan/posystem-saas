# Printer Setup Guide

Covers **browser printing** (receipts from the POS) and the **Electron** desktop app with **silent thermal** printing.

## Browser (web POS)

1. Use **Chrome** or **Edge** for the most predictable print dialog.
2. From a receipt preview, choose **Print** → select your OS printer.
3. In the print dialog, disable **headers/footers** for a cleaner receipt when possible.

**Common mistakes**

- Printing to **PDF** by accident during rush hour.
- Wrong **paper size** (A4 vs receipt roll)—check store settings for 58 mm vs 80 mm.

## Store settings (`/settings`)

**OWNER / ADMIN** only.

- **Receipt paper width** — match your physical roll (58 mm or 80 mm).
- **Auto-print after sale** — when enabled, the browser may still show a print dialog unless you use Electron silent mode.
- **Receipt logo URL** — must be `https://…` if enabled.

## Electron desktop (thermal, silent)

When the POS runs inside **Electron** with the bundled preload script:

1. **Thermal printer** installed at the OS level (Windows: Settings → Printers).
2. In **Store settings**, pick **Default thermal printer (Electron)** from the dropdown (populated from the machine).
3. Enable **auto-print** if you want one-tap checkout without a dialog.

**Common mistakes**

- Printer offline → silent print logs an error; check **Export logs** on the desktop diagnostics panel (see admin guide / troubleshooting).
- Choosing the **wrong device name**—re-select from the dropdown after driver renames.

## Product labels (`/product-labels`)

- Use label templates your build provides; match **label stock** dimensions in the print dialog.
- Prefer a dedicated **label printer** driver so sizes stay consistent.

## Roles

| Area | OWNER | ADMIN | CASHIER |
|------|:-----:|:-----:|:-------:|
| Change receipt / printer settings | ✓ | ✓ | ✗ |
| Print labels | ✓ | ✓ | ✗ |

## Short example: first-day thermal setup (Electron)

1. Install driver for “POS-80C” on Windows.
2. Launch Stock POS desktop build.
3. `/settings` → paper **80 mm** → printer **POS-80C** → enable **auto-print**.
4. Run a **$0.01 test sale** (void/refund per policy) to confirm cut and alignment.

## Related guides

- [Admin User Guide](./admin-user-guide.md)
- [Troubleshooting](./troubleshooting-guide.md)
