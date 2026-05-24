const raw = import.meta.env.VITE_API_URL as string | undefined;
const trimmed = raw?.trim();

if (import.meta.env.PROD && !trimmed) {
  console.warn(
    '[env] VITE_API_URL is not set. The app will default to http://localhost:3000, which is usually wrong in production.',
  );
}

/** API origin without trailing slash (`VITE_API_URL`, defaulting to local dev API). */
export const API_URL = (trimmed || 'http://localhost:3000').replace(/\/+$/, '');

/** Printed receipt header; override with `VITE_STORE_NAME`. */
export const STORE_NAME =
  (import.meta.env.VITE_STORE_NAME as string | undefined)?.trim() || 'Nezhin POS';

const rawCashierStock = import.meta.env.VITE_CASHIER_CAN_VIEW_STOCK_MOVEMENTS as string | undefined;

/** When `false` / `0`, cashiers cannot open the stock movements page (OWNER/ADMIN unaffected). */
export const CASHIER_CAN_VIEW_STOCK_MOVEMENTS =
  rawCashierStock === 'false' || rawCashierStock === '0' ? false : true;

const rawBypass = import.meta.env.VITE_BYPASS_LICENSE as string | undefined;

/** When `VITE_BYPASS_LICENSE` is true/1/yes, the POS skips license activation and UI locks (for local development). */
export const BYPASS_LICENSE =
  rawBypass === 'true' || rawBypass === '1' || String(rawBypass ?? '').toLowerCase() === 'yes';
