const raw = import.meta.env.VITE_API_URL as string | undefined;
const trimmed = raw?.trim();

const isElectronEnv =
  typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');

/**
 * In packaged Electron desktop mode the React build always talks to the
 * locally-spawned NestJS backend on 127.0.0.1:3001, regardless of whatever
 * VITE_API_URL was baked in at build time. This prevents the desktop app from
 * accidentally hitting the cloud SaaS API.
 *
 * The web SaaS deployment is unaffected (it is not running inside Electron).
 *
 * Dev Electron still honors VITE_API_URL so engineers can point at staging.
 */
function resolveDesktopBaseUrl(): string | null {
  if (!isElectronEnv) return null;
  if (!import.meta.env.PROD) return null;
  return 'http://127.0.0.1:3001';
}

const desktopUrl = resolveDesktopBaseUrl();

if (!desktopUrl && import.meta.env.PROD && !trimmed) {
  console.warn(
    '[env] VITE_API_URL is not set. The app will default to http://localhost:3000, which is usually wrong in production.',
  );
}

/** API origin without trailing slash (desktop → local backend, otherwise `VITE_API_URL`). */
export const API_URL = (desktopUrl || trimmed || 'http://localhost:3000').replace(/\/+$/, '');

export const IS_DESKTOP_APP = Boolean(desktopUrl);

/** Printed receipt header; override with `VITE_STORE_NAME`. */
export const STORE_NAME =
  (import.meta.env.VITE_STORE_NAME as string | undefined)?.trim() || 'Nezhin POS';

const rawCashierStock = import.meta.env.VITE_CASHIER_CAN_VIEW_STOCK_MOVEMENTS as string | undefined;

/** When `false` / `0`, cashiers cannot open the stock movements page (OWNER/ADMIN unaffected). */
export const CASHIER_CAN_VIEW_STOCK_MOVEMENTS =
  rawCashierStock === 'false' || rawCashierStock === '0' ? false : true;

const rawBypass = import.meta.env.VITE_BYPASS_LICENSE as string | undefined;

// License key activation only applies to the Electron desktop app.
// In any web browser context (SaaS deployment) the check is bypassed by default
// unless VITE_BYPASS_LICENSE is explicitly set to 'false' or '0'.
const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');

/** True in web browser (SaaS) by default; true in Electron only when VITE_BYPASS_LICENSE=true/1/yes. */
export const BYPASS_LICENSE =
  rawBypass === 'false' || rawBypass === '0'
    ? false
    : rawBypass === 'true' || rawBypass === '1' || String(rawBypass ?? '').toLowerCase() === 'yes'
    ? true
    : !isElectron;
