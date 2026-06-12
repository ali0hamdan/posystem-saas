/**
 * Tests for the SaaS Super Admin URL hardening middleware.
 *
 * The middleware lives in `backend/src/saas/saas-admin-prefix.middleware.ts`
 * and is wired in `main.ts` before NestJS handles requests. It implements
 * the backend half of the "configurable Super Admin path" feature:
 *
 *   - DEFAULT (`SAAS_ADMIN_API_PREFIX` unset or `'saas'`): no-op pass-through,
 *     X-Robots-Tag added on `/saas/*` responses.
 *   - CUSTOM (`SAAS_ADMIN_API_PREFIX='nz-…-8f3k'`):
 *       /nz-.../auth/login → req.url rewritten to /saas/auth/login (controllers
 *       match unchanged); /saas/auth/login → 404 (legacy path blocked);
 *       X-Robots-Tag on both before either decision so crawlers don't index
 *       the existence of /saas/*.
 */

import { createSaasAdminPrefixMiddleware, resolveSaasAdminPrefix } from '../saas/saas-admin-prefix.middleware';

type MockResponse = {
  statusCode: number | null;
  jsonBody: unknown;
  headers: Record<string, string>;
  status: jest.Mock;
  json: jest.Mock;
  setHeader: jest.Mock;
};

function makeReq(url: string) {
  return { url } as { url: string };
}

function makeRes(): MockResponse {
  const res: Partial<MockResponse> = {
    statusCode: null,
    jsonBody: undefined,
    headers: {},
  };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res as MockResponse;
  });
  res.json = jest.fn((body: unknown) => {
    res.jsonBody = body;
    return res as MockResponse;
  });
  res.setHeader = jest.fn((name: string, value: string) => {
    res.headers![name] = value;
  });
  return res as MockResponse;
}

// ---------------------------------------------------------------------------
// resolveSaasAdminPrefix
// ---------------------------------------------------------------------------

describe('resolveSaasAdminPrefix', () => {
  it('returns the default `saas` when env is unset', () => {
    expect(resolveSaasAdminPrefix({} as NodeJS.ProcessEnv)).toBe('saas');
  });

  it('strips leading/trailing slashes and whitespace', () => {
    expect(resolveSaasAdminPrefix({ SAAS_ADMIN_API_PREFIX: '  /nz-x/  ' } as never)).toBe('nz-x');
  });

  it('returns the default when the env value is empty after cleanup', () => {
    expect(resolveSaasAdminPrefix({ SAAS_ADMIN_API_PREFIX: '   ' } as never)).toBe('saas');
    expect(resolveSaasAdminPrefix({ SAAS_ADMIN_API_PREFIX: '/' } as never)).toBe('saas');
  });
});

// ---------------------------------------------------------------------------
// Middleware — default behavior
// ---------------------------------------------------------------------------

describe('SaasAdminPrefix middleware — default prefix (saas)', () => {
  const mw = createSaasAdminPrefixMiddleware({ prefix: 'saas' });

  it('passes /saas/* through and sets X-Robots-Tag', () => {
    const req = makeReq('/saas/auth/login');
    const res = makeRes();
    const next = jest.fn();
    mw(req as never, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.url).toBe('/saas/auth/login');
    expect(res.headers['X-Robots-Tag']).toBe('noindex, nofollow');
    expect(res.status).not.toHaveBeenCalled();
  });

  it('leaves non-SaaS URLs untouched and does not set X-Robots-Tag', () => {
    const req = makeReq('/health');
    const res = makeRes();
    const next = jest.fn();
    mw(req as never, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.url).toBe('/health');
    expect(res.headers['X-Robots-Tag']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Middleware — custom prefix
// ---------------------------------------------------------------------------

describe('SaasAdminPrefix middleware — custom prefix (nz-control-8f3k)', () => {
  const mw = createSaasAdminPrefixMiddleware({ prefix: 'nz-control-8f3k' });

  it('rewrites /nz-control-8f3k/* to /saas/*', () => {
    const req = makeReq('/nz-control-8f3k/auth/login');
    const res = makeRes();
    const next = jest.fn();
    mw(req as never, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.url).toBe('/saas/auth/login');
    expect(res.headers['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  it('preserves query string when rewriting', () => {
    const req = makeReq('/nz-control-8f3k/clients?page=2&q=acme');
    const res = makeRes();
    const next = jest.fn();
    mw(req as never, res as never, next);
    expect(req.url).toBe('/saas/clients?page=2&q=acme');
  });

  it('rewrites the bare prefix path (/nz-control-8f3k) to /saas', () => {
    const req = makeReq('/nz-control-8f3k');
    const res = makeRes();
    const next = jest.fn();
    mw(req as never, res as never, next);
    expect(req.url).toBe('/saas');
  });

  it('returns 404 when the legacy /saas/* path is hit', () => {
    const req = makeReq('/saas/auth/login');
    const res = makeRes();
    const next = jest.fn();
    mw(req as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.jsonBody).toEqual({ statusCode: 404, message: 'Not Found' });
    expect(next).not.toHaveBeenCalled();
    // X-Robots-Tag must still be set so crawlers don't store the legacy path.
    expect(res.headers['X-Robots-Tag']).toBe('noindex, nofollow');
  });

  it('returns 404 for bare legacy /saas as well', () => {
    const req = makeReq('/saas');
    const res = makeRes();
    const next = jest.fn();
    mw(req as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('does not match /saasx (prefix boundary)', () => {
    const req = makeReq('/saasx/leak');
    const res = makeRes();
    const next = jest.fn();
    mw(req as never, res as never, next);
    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.url).toBe('/saasx/leak');
  });

  it('does not match /nz-control-8f3k-extra (prefix boundary)', () => {
    const req = makeReq('/nz-control-8f3k-extra/login');
    const res = makeRes();
    const next = jest.fn();
    mw(req as never, res as never, next);
    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.url).toBe('/nz-control-8f3k-extra/login');
  });

  it('leaves non-SaaS routes untouched even when a custom prefix is configured', () => {
    const req = makeReq('/auth/login');
    const res = makeRes();
    const next = jest.fn();
    mw(req as never, res as never, next);
    expect(req.url).toBe('/auth/login');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.headers['X-Robots-Tag']).toBeUndefined();
  });
});
