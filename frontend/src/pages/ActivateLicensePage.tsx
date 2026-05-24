import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { activateLicenseRequest } from '@/api/license.api';
import { getOrCreateDeviceId } from '@/lib/device-id';
import { useAuthStore } from '@/stores/auth-store';
import { useLicenseStore } from '@/stores/license-store';
import { BYPASS_LICENSE } from '@/lib/env';
import { useLicenseHydrated } from '@/hooks/use-license-hydrated';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function ActivateLicensePage() {
  const navigate = useNavigate();
  const licenseHydrated = useLicenseHydrated();
  const existingToken = useLicenseStore((s) => s.token);
  const setLicense = useLicenseStore((s) => s.setLicense);
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!licenseHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    );
  }

  if (!BYPASS_LICENSE && existingToken) {
    return <Navigate to="/login" replace />;
  }

  if (BYPASS_LICENSE) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
        <p className="text-sm text-ink-muted">License bypass is enabled (VITE_BYPASS_LICENSE). Activation is not required.</p>
        <Link to="/login" className="mt-4 text-sm font-semibold text-primary-600">
          Continue to sign in
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const res = await activateLicenseRequest({
        activationCode: code,
        deviceId,
        deviceName: deviceName.trim() || 'POS Terminal',
      });
      useAuthStore.getState().clearAuth();
      setLicense(res.licenseToken, res.publicKeyPem, res.clientSlug);
      navigate('/login', { replace: true, state: { activated: true } });
    } catch (er: unknown) {
      setErr(er instanceof Error ? er.message : 'Activation failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle compact />
      </div>
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-8 shadow-card">
        <h1 className="font-display text-xl font-semibold text-ink">Activate this POS</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Paste the full activation code from your platform admin (starts with POS-). A stable device ID is saved in
          this browser.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {err ? (
            <div role="alert" className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
              {err}
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-ink-muted">Activation code</label>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 font-mono text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
              autoComplete="off"
              spellCheck={false}
              placeholder="POS-…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-ink-muted">Device label (optional)</label>
            <input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Front counter iPad"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <p className="text-xs text-ink-muted">
            Codes from the platform admin for a store use the full POS- code above. Business details below are only for
            legacy unbound codes.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase text-ink-muted">Business name</label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-ink-muted">Owner name</label>
              <input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-ink-muted">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase text-ink-muted">Phone (optional)</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
          >
            {busy ? 'Activating…' : 'Activate'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-ink-muted">
          Already activated?{' '}
          <Link to="/login" className="font-semibold text-primary-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
