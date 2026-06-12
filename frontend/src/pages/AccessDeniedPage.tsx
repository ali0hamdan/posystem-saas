import { ShieldOff } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AccessDeniedPage() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-50 text-danger-600 dark:bg-danger-500/10">
        <ShieldOff className="h-7 w-7" aria-hidden />
      </div>
      <h1 className="font-display text-xl font-semibold text-ink md:text-2xl">Access denied</h1>
      <p className="mt-2 max-w-md text-sm text-ink-muted">
        You do not have permission to access this page.
      </p>
      <Link
        to="/dashboard"
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
