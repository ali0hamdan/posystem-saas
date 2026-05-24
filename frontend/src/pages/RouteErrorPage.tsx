import { useEffect } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { logClientError } from '@/lib/frontend-logger';

export function RouteErrorPage() {
  const err = useRouteError();

  useEffect(() => {
    const e = err instanceof Error ? err : new Error(isRouteErrorResponse(err) ? err.statusText : String(err));
    logClientError('router', e, {
      routeStatus: isRouteErrorResponse(err) ? err.status : undefined,
    });
  }, [err]);

  const title = isRouteErrorResponse(err) ? `${err.status} ${err.statusText || 'Error'}` : 'Navigation error';
  const detail = isRouteErrorResponse(err)
    ? typeof err.data === 'string'
      ? err.data
      : 'The route could not be loaded.'
    : err instanceof Error
      ? err.message
      : 'An unexpected error occurred.';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center text-ink">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-md text-sm text-ink-muted">{detail}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to="/dashboard"
          className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-500"
        >
          Go to dashboard
        </Link>
        <button
          type="button"
          className="rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink hover:bg-canvas"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    </div>
  );
}
