/**
 * Configurable Super Admin path prefixes.
 *
 * The Super Admin dashboard is a high-value target. Hiding it behind a
 * non-default path reduces drive-by reconnaissance and bot scanning. This is
 * **security through obscurity** — it is NOT a replacement for authentication:
 * the SaaS JWT, role guards, login throttle, account lockout, and 2FA all
 * remain in place regardless of which prefix is in use.
 *
 * Two independent prefixes:
 *   - `SAAS_ADMIN_BASE_PATH`   — frontend URL prefix. Read from
 *     `VITE_SUPER_ADMIN_BASE_PATH`. Used to build every router path and
 *     navigate / Link target inside the SaaS dashboard.
 *   - `SAAS_ADMIN_API_PREFIX`  — backend API prefix. Read from
 *     `VITE_SUPER_ADMIN_API_PREFIX`. Used by the `saasApi` axios instance to
 *     rewrite outbound URLs (default `/saas/*` → configured prefix).
 *
 * Defaults intentionally fall back to the original `saas` value so an
 * unconfigured environment (local dev, CI, existing deployments mid-rollout)
 * keeps working. The backend's analogous middleware does the same.
 */

const RAW_BASE = (import.meta.env.VITE_SUPER_ADMIN_BASE_PATH as string | undefined)?.trim();
const RAW_API = (import.meta.env.VITE_SUPER_ADMIN_API_PREFIX as string | undefined)?.trim();

function normalize(p: string | undefined, fallback: string): string {
  if (!p) return fallback;
  // Ensure exactly one leading slash, no trailing slash, no whitespace.
  const cleaned = p.replace(/\s+/g, '').replace(/^\/+/, '/').replace(/\/+$/, '');
  if (cleaned.length === 0 || cleaned === '/') return fallback;
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

/** URL prefix for the React router (e.g. `/saas` or `/nz-control-8f3k`). */
export const SAAS_ADMIN_BASE_PATH = normalize(RAW_BASE, '/saas');

/** URL prefix for backend SaaS admin API calls (e.g. `/saas` or `/saas-admin-api-8f3k`). */
export const SAAS_ADMIN_API_PREFIX = normalize(RAW_API, '/saas');

/** True when the deployment is using a non-default Super Admin URL prefix. */
export const HAS_CUSTOM_ADMIN_PATH = SAAS_ADMIN_BASE_PATH !== '/saas';

/**
 * Build a Super Admin route path under the configured base.
 * Always returns an absolute path beginning with the base prefix.
 *
 *   saasPath('/login')      → '/nz-control-8f3k/login'
 *   saasPath('dashboard')   → '/nz-control-8f3k/dashboard'
 *   saasPath('')            → '/nz-control-8f3k'
 */
export function saasPath(suffix: string): string {
  const trimmed = suffix.replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed ? `${SAAS_ADMIN_BASE_PATH}/${trimmed}` : SAAS_ADMIN_BASE_PATH;
}

/**
 * Rewrite a legacy `/saas/...` API URL to the configured API prefix so
 * existing axios calls keep their literal string but actually hit the
 * non-default path. No-op when the prefix is the default `/saas`.
 */
export function rewriteSaasApiUrl(url: string): string {
  if (SAAS_ADMIN_API_PREFIX === '/saas') return url;
  // Absolute http(s) URLs may include a host — rewrite only the path portion.
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url);
      u.pathname = u.pathname.replace(/^\/saas(?=\/|$)/, SAAS_ADMIN_API_PREFIX);
      return u.toString();
    } catch {
      return url;
    }
  }
  return url.replace(/^\/saas(?=\/|$)/, SAAS_ADMIN_API_PREFIX);
}
