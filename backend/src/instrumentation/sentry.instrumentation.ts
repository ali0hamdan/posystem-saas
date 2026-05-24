import * as Sentry from '@sentry/node';

let started = false;

/** Optional Sentry for the API process (enable with `SENTRY_DSN`). */
export function initBackendSentry(): void {
  if (started) {
    return;
  }
  const dsn = (process.env.SENTRY_DSN ?? '').trim();
  if (!dsn) {
    return;
  }
  started = true;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}

export function captureApiException(
  exception: unknown,
  context: Record<string, string | number | null | undefined>,
): void {
  if (!started) {
    return;
  }
  Sentry.withScope((scope) => {
    for (const [k, v] of Object.entries(context)) {
      if (v === undefined || v === null) {
        continue;
      }
      const key = k.replace(/[^a-zA-Z0-9_\-:.]/g, '_').slice(0, 32);
      scope.setTag(key, String(v).slice(0, 200));
    }
    if (exception instanceof Error) {
      Sentry.captureException(exception);
    } else {
      Sentry.captureException(new Error(String(exception)));
    }
  });
}
