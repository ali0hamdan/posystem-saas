import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, CheckCircle, Clock, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { pingLicense } from '@/api/license.api';
import { BYPASS_LICENSE } from '@/lib/env';
import { useLicenseStore } from '@/stores/license-store';
import { usePlanFeature } from '@/hooks/use-plan-features';
import { useFeature, useBusinessType } from '@/hooks/use-tenant-context';
import { Button } from '@/components/ui/button';

const DESKTOP_APP_LABEL: Record<string, string> = {
  RETAIL: 'Download Retail Desktop App',
  FOOD_BEVERAGE: 'Download F&B Desktop App',
  WHOLESALE: 'Download Wholesale Desktop App',
  HYBRID: 'Download Hybrid Desktop App',
};

type PingData = {
  ok?: boolean;
  bypass?: boolean;
  plan?: string;
  status?: string;
  expiresAt?: string | null;
  lockAfter?: string;
  graceDays?: number;
  /** Null = unlimited (Desktop Lifetime). */
  maxUsers?: number | null;
  maxBranches?: number | null;
  maxDevices?: number | null;
  warning?: boolean;
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  LIFETIME: 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900',
  TRIALING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  PAST_DUE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  SUSPENDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  EXPIRED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

function daysUntil(isoDate?: string | null): number | null {
  if (!isoDate) return null;
  const ms = new Date(isoDate).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

function ExpiryIndicator({ expiresAt, warning }: { expiresAt?: string | null; warning?: boolean }) {
  const days = daysUntil(expiresAt);
  if (!expiresAt) {
    return (
      <div className="flex items-center gap-2 text-ink">
        <CheckCircle className="h-4 w-4" />
        <span className="text-sm font-medium">Never expires (Lifetime)</span>
      </div>
    );
  }
  if (days === null) return null;
  if (days < 0) {
    return (
      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">
          {warning ? 'In grace period' : 'Expired'}
        </span>
      </div>
    );
  }
  if (days <= 14) {
    return (
      <div className="flex items-center gap-2 text-orange-500 dark:text-orange-400">
        <Clock className="h-4 w-4" />
        <span className="text-sm font-medium">Expires in {days} day{days !== 1 ? 's' : ''}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-green-600 dark:text-green-500">
      <CheckCircle className="h-4 w-4" />
      <span className="text-sm font-medium">
        Active — {days} days remaining
      </span>
    </div>
  );
}

export function BillingPage() {
  const bypass = BYPASS_LICENSE;
  const licToken = useLicenseStore((s) => s.token);
  const clearLicense = useLicenseStore((s) => s.clearLicense);
  // Desktop download is gated by the plan's desktop_download feature flag
  // (set on PRO and all Desktop Lifetime plans) — not on normal monthly/yearly plans.
  const desktopFeature = useFeature('desktop_download');
  const offlineFallback = usePlanFeature('offline_mode');
  const canDownload = desktopFeature || offlineFallback;
  const businessType = useBusinessType();

  const q = useQuery({
    queryKey: ['license', 'ping', 'billing'],
    queryFn: () => pingLicense() as Promise<PingData>,
    enabled: !bypass && Boolean(licToken),
    staleTime: 30_000,
  });

  if (bypass) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription & Billing</h1>
        <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-300">
          License bypass is active — no subscription is enforced in this build.
        </div>
      </div>
    );
  }

  if (!licToken) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription & Billing</h1>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <ShieldCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No license on this device.</p>
          <Link to="/activate" className="mt-3 inline-block text-sm font-semibold text-primary-600 hover:underline">
            Activate device
          </Link>
        </div>
      </div>
    );
  }

  const d: PingData = q.data ?? {};

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription & Billing</h1>
        <Button variant="secondary" size="sm" onClick={() => void q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${q.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {q.isError && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          Could not reach the license server. Your device is operating within its grace window.
        </div>
      )}

      {d.warning && (
        <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4 text-sm text-orange-700 dark:text-orange-400 flex items-start justify-between gap-4">
          <div>
            <AlertTriangle className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            Your subscription has expired. You are in the grace period. Please renew to avoid service interruption.
          </div>
          <Link
            to="/pricing"
            className="shrink-0 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 transition-colors"
          >
            Renew now
          </Link>
        </div>
      )}

      {/* Subscription card */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {d.plan ?? 'Loading…'}
            </h2>
            {d.status && (
              <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[d.status] ?? 'bg-gray-100 text-gray-700'}`}>
                {d.status}
              </span>
            )}
          </div>
          <ExpiryIndicator expiresAt={d.expiresAt} warning={d.warning} />
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
          {d.expiresAt && (
            <div>
              <dt className="text-xs uppercase text-gray-400 dark:text-gray-500 mb-0.5">Expires</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {new Date(d.expiresAt).toLocaleDateString()}
              </dd>
            </div>
          )}
          {d.graceDays !== undefined && (
            <div>
              <dt className="text-xs uppercase text-gray-400 dark:text-gray-500 mb-0.5">Grace period</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{d.graceDays} days</dd>
            </div>
          )}
          {d.lockAfter && d.expiresAt && (
            <div>
              <dt className="text-xs uppercase text-gray-400 dark:text-gray-500 mb-0.5">Hard lock</dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {new Date(d.lockAfter).toLocaleDateString()}
              </dd>
            </div>
          )}
          {d.maxUsers !== undefined && (
            <div>
              <dt className="text-xs uppercase text-gray-400 dark:text-gray-500 mb-0.5">Max users</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{d.maxUsers ?? 'Unlimited'}</dd>
            </div>
          )}
          {d.maxBranches !== undefined && (
            <div>
              <dt className="text-xs uppercase text-gray-400 dark:text-gray-500 mb-0.5">Max branches</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{d.maxBranches ?? 'Unlimited'}</dd>
            </div>
          )}
          {d.maxDevices !== undefined && (
            <div>
              <dt className="text-xs uppercase text-gray-400 dark:text-gray-500 mb-0.5">Max devices</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{d.maxDevices ?? 'Unlimited'}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <a
          href="/pricing"
          className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
        >
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Upgrade your plan</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">See all available plans</p>
          </div>
          <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
        </a>

        <Link
          to="/activate"
          className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
        >
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Activate a new device</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Use an activation code on this device</p>
          </div>
          <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
        </Link>

        {canDownload && (
          <Link
            to="/download"
            className="flex items-center justify-between rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 p-4 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors group"
          >
            <div>
              <p className="text-sm font-medium text-ink">
                {(businessType && DESKTOP_APP_LABEL[businessType]) ?? 'Download Nezhin POS Desktop'}
              </p>
              <p className="text-xs text-ink-muted">Works offline — included in your plan</p>
            </div>
            <Download className="h-4 w-4 text-ink-muted group-hover:text-ink" />
          </Link>
        )}
      </div>

      {/* Danger zone */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => clearLicense()}
        >
          Clear license from this device
        </Button>
        <p className="mt-1 text-xs text-gray-400">This will require you to re-activate this device.</p>
      </div>
    </div>
  );
}
