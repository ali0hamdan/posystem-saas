import { useEffect } from 'react';

/**
 * 404 page shown when a custom Super Admin path is configured AND a visitor
 * hits the well-known `/saas/*` URL.
 *
 * Renders a generic "Page not found" — no hint that the real dashboard
 * lives elsewhere, no link to login. Adds a noindex meta tag so search
 * crawlers don't store the legacy path.
 */
export function LegacySaasNotFound() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow';
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = 'Page not found';
    return () => {
      meta.remove();
      document.title = prevTitle;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
      <p className="text-xs uppercase tracking-wide text-ink-faint">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-ink-muted">
        The page you are looking for does not exist on this server.
      </p>
    </div>
  );
}
