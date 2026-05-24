import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BYPASS_LICENSE } from '@/lib/env';
import { pingLicense } from '@/api/license.api';
import { useAuthStore } from '@/stores/auth-store';
import { useLicenseStore } from '@/stores/license-store';

function daysUntil(iso: string): number {
  const t = new Date(iso).getTime() - Date.now();
  return Math.ceil(t / 86_400_000);
}

export function LicenseShell() {
  const bypass = BYPASS_LICENSE;
  const accessToken = useAuthStore((s) => s.accessToken);
  const licToken = useLicenseStore((s) => s.token);
  const lockReason = useLicenseStore((s) => s.lockReason);
  const clearLicense = useLicenseStore((s) => s.clearLicense);
  const notePingOk = useLicenseStore((s) => s.notePingOk);

  const pingQuery = useQuery({
    queryKey: ['license', 'ping'],
    queryFn: () => pingLicense() as Promise<{
      ok?: boolean;
      bypass?: boolean;
      lockAfter?: string;
      expiresAt?: string;
      plan?: string;
    }>,
    enabled: !bypass && Boolean(accessToken) && Boolean(licToken),
    refetchInterval: 4 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (pingQuery.isSuccess && pingQuery.data && !(pingQuery.data as { bypass?: boolean }).bypass) {
      notePingOk();
    }
  }, [pingQuery.isSuccess, pingQuery.data, notePingOk]);

  if (bypass) return null;

  if (lockReason) {
    return (
      <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-ink/95 px-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-white">License required</h1>
        <p className="mt-3 max-w-md text-sm text-white/80">{lockReason}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/activate"
            className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-500"
            onClick={() => clearLicense()}
          >
            Re-activate device
          </Link>
        </div>
      </div>
    );
  }

  const lockAfter = pingQuery.data && typeof pingQuery.data === 'object' ? (pingQuery.data as { lockAfter?: string }).lockAfter : undefined;
  const warn = lockAfter && daysUntil(lockAfter) <= 14 && daysUntil(lockAfter) >= 0;

  return (
    <>
      {warn ? (
        <div className="mb-4 rounded-xl border border-warning-300 bg-warning-100 px-4 py-3 text-sm text-warning-900">
          <span className="font-medium">License notice:</span> this deployment locks after{' '}
          <span className="font-mono">{new Date(lockAfter!).toLocaleDateString()}</span> ({daysUntil(lockAfter!)} day
          {daysUntil(lockAfter!) === 1 ? '' : 's'} left).{' '}
          <Link to="/license" className="font-semibold text-warning-800 underline underline-offset-2">
            View license status
          </Link>
        </div>
      ) : null}
    </>
  );
}
