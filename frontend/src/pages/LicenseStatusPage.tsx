import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { pingLicense } from '@/api/license.api';
import { BYPASS_LICENSE } from '@/lib/env';
import { useAuthStore } from '@/stores/auth-store';
import { useLicenseStore } from '@/stores/license-store';
import { Button } from '@/components/ui/button';

export function LicenseStatusPage() {
  const bypass = BYPASS_LICENSE;
  const accessToken = useAuthStore((s) => s.accessToken);
  const licToken = useLicenseStore((s) => s.token);
  const clearLicense = useLicenseStore((s) => s.clearLicense);

  const q = useQuery({
    queryKey: ['license', 'ping', 'page'],
    queryFn: () => pingLicense() as Promise<Record<string, unknown>>,
    enabled: !bypass && Boolean(accessToken) && Boolean(licToken),
  });

  if (bypass) {
    return (
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">License</h1>
        <p className="mt-2 text-sm text-ink-muted">Bypass mode is on — no license is enforced for this build.</p>
      </div>
    );
  }

  if (!licToken) {
    return (
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">License</h1>
        <p className="mt-2 text-sm text-ink-muted">No license token stored on this device.</p>
        <Link to="/activate" className="mt-4 inline-block text-sm font-semibold text-primary-700">
          Activate now
        </Link>
      </div>
    );
  }

  const d = (q.data ?? {}) as {
    plan?: string;
    expiresAt?: string;
    lockAfter?: string;
    maxBranches?: number | null;
    maxDevices?: number | null;
    serverTime?: string;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">License status</h1>
        <p className="mt-1 text-sm text-ink-muted">Last server check for this browser/device.</p>
      </div>
      {q.isLoading ? <p className="text-sm text-ink-muted">Loading…</p> : null}
      {q.isError ? (
        <p className="text-sm text-danger-700">Could not reach the license service. You may be offline within the grace window.</p>
      ) : null}
      {q.isSuccess ? (
        <div className="rounded-2xl border border-line bg-surface p-5 text-sm text-ink">
          <dl className="grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-ink-muted">Plan</dt>
              <dd className="font-medium">{String(d.plan ?? '—')}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-ink-muted">License expires</dt>
              <dd className="font-mono">{d.expiresAt ? new Date(d.expiresAt).toLocaleString() : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-ink-muted">Hard lock after (incl. grace)</dt>
              <dd className="font-mono">{d.lockAfter ? new Date(d.lockAfter).toLocaleString() : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-ink-muted">Server time</dt>
              <dd className="font-mono">{d.serverTime ? new Date(d.serverTime).toLocaleString() : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-ink-muted">Max branches</dt>
              <dd>{d.maxBranches === null ? 'Unlimited' : d.maxBranches ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-ink-muted">Max devices</dt>
              <dd>{d.maxDevices === null ? 'Unlimited' : d.maxDevices ?? '—'}</dd>
            </div>
          </dl>
        </div>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => clearLicense()}
      >
        Clear stored license (requires re-activation)
      </Button>
    </div>
  );
}
