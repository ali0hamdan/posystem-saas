import * as Sentry from '@sentry/react';

/** Browser Sentry (optional `VITE_SENTRY_DSN`). Call once before rendering the app. */
export function initFrontendSentry(): void {
  const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') {
        const data = breadcrumb.data as Record<string, unknown> | undefined;
        if (data?.url && typeof data.url === 'string' && /password|token|secret/i.test(data.url)) {
          return null;
        }
      }
      return breadcrumb;
    },
  });
}
