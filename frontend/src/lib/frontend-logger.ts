import axios, { type AxiosError } from 'axios';

const SENSITIVE_KEY = /password|token|secret|authorization|bearer|cvv|cardnumber|pan|creditcard/i;

/** Recursively redact obvious secret fields for client-side diagnostics. */
export function sanitizeForLog(input: unknown, depth = 0): unknown {
  if (depth > 8) return '[MAX_DEPTH]';
  if (input === null || typeof input === 'undefined') return input;
  if (typeof input === 'string') {
    if (input.length > 2000) return `${input.slice(0, 2000)}…`;
    return input;
  }
  if (typeof input !== 'object') return input;
  if (Array.isArray(input)) {
    return input.slice(0, 50).map((x) => sanitizeForLog(x, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = sanitizeForLog(v, depth + 1);
    }
  }
  return out;
}

function getRequestIdFromAxiosHeaders(headers: unknown): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const h = headers as { get?: (n: string) => string | undefined } & Record<string, unknown>;
  if (typeof h.get === 'function') {
    const v = h.get('x-request-id');
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  const raw = h['x-request-id'] ?? h['X-Request-Id'];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0].trim();
  return undefined;
}

/** Log client-side issues (console + optional Sentry). Never pass raw tokens. */
export function logClientError(
  scope: string,
  err: unknown,
  extra?: Record<string, unknown>,
): void {
  const message = err instanceof Error ? err.message : String(err);
  const safeExtra = extra ? sanitizeForLog(extra) : undefined;
  const payload = sanitizeForLog({ scope, message, ...((safeExtra as object) ?? {}) });
  // eslint-disable-next-line no-console -- intentional client diagnostics
  console.warn(`[client:${scope}]`, payload);

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn?.trim()) return;

  void import('@sentry/react').then((Sentry) => {
    if (err instanceof Error) {
      Sentry.captureException(err, { extra: payload as Record<string, unknown> });
    } else {
      Sentry.captureMessage(`[${scope}] ${message}`, { level: 'error', extra: payload as Record<string, unknown> });
    }
  });
}

export function getRequestIdFromError(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  return getRequestIdFromAxiosHeaders(error.response?.headers);
}

export function logApiResponseError(error: unknown): void {
  if (!axios.isAxiosError(error)) return;
  const ax = error as AxiosError;
  const status = ax.response?.status;
  if (!status || status < 500) return;
  const requestId = getRequestIdFromAxiosHeaders(ax.response?.headers);
  logClientError('api', ax, {
    status,
    requestId,
    method: ax.config?.method,
    path: ax.config?.url,
  });
}
