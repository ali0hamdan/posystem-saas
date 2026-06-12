import type { Request, Response, NextFunction } from 'express';

/**
 * SaaS Super Admin API prefix middleware.
 *
 * The NestJS controllers are decorated with `@Controller('saas/...')`. To
 * hide the well-known `/saas/*` path behind a deployment-specific prefix
 * without rewriting every controller, this middleware does two things
 * before the router sees the request:
 *
 *  1. If the configured prefix is something other than the default `saas`
 *     and the request URL starts with `/<prefix>/...`, rewrite `req.url`
 *     to `/saas/...` so the controllers match.
 *  2. After rewriting, OR if the URL starts with the literal `/saas/...`
 *     while a custom prefix is configured, also respond 404 — the old
 *     well-known path must stop responding to defeat reconnaissance.
 *
 * Defaults safely: when no env is set (and when the configured value is
 * exactly `saas`), the middleware is a no-op and the existing dev flow is
 * unchanged.
 *
 * Always sets `X-Robots-Tag: noindex, nofollow` on any response that
 * passes through the SaaS admin API (whether via the new prefix or the
 * default), so crawlers that somehow find the endpoint don't index it.
 */

const DEFAULT_PREFIX = 'saas';

function normalizePrefix(raw: string | undefined): string {
  if (!raw) return DEFAULT_PREFIX;
  const cleaned = raw.replace(/\s+/g, '').replace(/^\/+/, '').replace(/\/+$/, '');
  return cleaned.length > 0 ? cleaned : DEFAULT_PREFIX;
}

export function resolveSaasAdminPrefix(env: NodeJS.ProcessEnv = process.env): string {
  return normalizePrefix(env.SAAS_ADMIN_API_PREFIX);
}

export type SaasAdminPrefixOptions = {
  /** Override the env-derived prefix (used by tests). */
  prefix?: string;
  /** Override the URL the middleware rewrites to internally (default `saas`). */
  internalPrefix?: string;
};

export function createSaasAdminPrefixMiddleware(opts: SaasAdminPrefixOptions = {}) {
  const prefix = opts.prefix ?? resolveSaasAdminPrefix();
  const internal = opts.internalPrefix ?? DEFAULT_PREFIX;
  const isCustom = prefix !== DEFAULT_PREFIX;

  // Pre-compiled prefix tests for the two URL shapes the middleware cares
  // about. We compare the **path** portion only; query strings are kept.
  const customRe = new RegExp(`^/${escapeRegex(prefix)}(?=/|$)`);
  const internalRe = new RegExp(`^/${escapeRegex(internal)}(?=/|$)`);

  return function saasAdminPrefixMiddleware(req: Request, res: Response, next: NextFunction): void {
    const url = req.url || '/';
    const pathOnly = url.split('?')[0];
    const onSaasFamily = customRe.test(pathOnly) || internalRe.test(pathOnly);

    if (onSaasFamily) {
      // Defense-in-depth: make sure no crawler caches admin URLs even if
      // a misconfigured proxy serves them publicly.
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }

    if (!isCustom) {
      // Default config — nothing to rewrite or block.
      return next();
    }

    // Block the default `/saas/...` path entirely when a custom prefix is
    // active. Returning 404 (not 403) matches the "looks like a missing
    // route" narrative the frontend's LegacySaasNotFound page tells.
    if (internalRe.test(pathOnly)) {
      res.status(404).json({
        statusCode: 404,
        message: 'Not Found',
      });
      return;
    }

    // Rewrite the configured prefix to the internal `/saas/...` so existing
    // controllers handle it. Preserves query string.
    if (customRe.test(pathOnly)) {
      req.url = url.replace(customRe, `/${internal}`);
    }
    next();
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
