import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL, IS_DESKTOP_APP } from '@/lib/env';
import { useLicenseStore } from '@/stores/license-store';

type ActivationStatus =
  | { activated: false }
  | {
      activated: true;
      licenseToken?: string;
      licensePublicKeyPem?: string;
      clientId: string;
      businessType: 'RETAIL' | 'FOOD_BEVERAGE' | 'WHOLESALE';
      planCode?: string;
      businessName: string;
      ownerEmail: string;
      lifetimeLicense: boolean;
      entitlements: {
        supportActive: boolean | null;
        cloudHostingActive: boolean | null;
        updatesActive: boolean | null;
      };
    };

type OwnerStatus =
  | { provisioned: false; hasOwner: false }
  | {
      provisioned: true;
      hasOwner: boolean;
      owner: {
        username: string;
        email: string | null;
        clientId: string;
        businessName: string;
        businessType: string;
      } | null;
    };

type GateState =
  | { phase: 'loading' }
  | { phase: 'ready' }
  | {
      phase: 'needs-activation';
      lastError?: string;
    }
  | {
      phase: 'needs-owner';
      activation: Extract<ActivationStatus, { activated: true }>;
      lastError?: string;
    };

async function fetchOwnerStatus(): Promise<OwnerStatus | null> {
  try {
    const res = await fetch(`${API_URL}/desktop/status`, { method: 'GET' });
    if (!res.ok) return null;
    return (await res.json()) as OwnerStatus;
  } catch {
    return null;
  }
}

export function DesktopActivationGate({ children }: { children: React.ReactNode }) {
  const inDesktop = IS_DESKTOP_APP && typeof window.electronDesktopActivation !== 'undefined';
  const [state, setState] = useState<GateState>(inDesktop ? { phase: 'loading' } : { phase: 'ready' });

  const refresh = useCallback(async () => {
    if (!inDesktop) return;
    setState({ phase: 'loading' });
    const activation = (await window.electronDesktopActivation!.getStatus()) as ActivationStatus;
    if (!activation.activated) {
      // Clear any stale token left over from a prior install / reset.
      useLicenseStore.getState().clearLicense();
      setState({ phase: 'needs-activation' });
      return;
    }
    // Hydrate the renderer's license store from license.json so every
    // axios request automatically carries X-License-Token. Web SaaS is
    // unaffected — this only runs when the Electron bridge exists.
    if (activation.licenseToken && activation.licensePublicKeyPem) {
      const store = useLicenseStore.getState();
      if (store.token !== activation.licenseToken) {
        store.setLicense(activation.licenseToken, activation.licensePublicKeyPem, null);
      }
    }
    const owner = await fetchOwnerStatus();
    if (!owner || !owner.provisioned || !owner.hasOwner) {
      setState({ phase: 'needs-owner', activation });
      return;
    }
    setState({ phase: 'ready' });
  }, [inDesktop]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!inDesktop || state.phase === 'ready') {
    return <>{children}</>;
  }
  if (state.phase === 'loading') {
    return <CenteredMessage>Loading desktop license…</CenteredMessage>;
  }
  if (state.phase === 'needs-activation') {
    return <ActivationForm lastError={state.lastError} onSuccess={refresh} />;
  }
  return <OwnerSetupForm activation={state.activation} lastError={state.lastError} onSuccess={refresh} />;
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <p className="text-sm text-ink-muted">{children}</p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-ink">{children}</label>;
}

function FormShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl bg-surface p-8 shadow">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          <p className="text-sm text-ink-muted">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function ActivationForm({ lastError, onSuccess }: { lastError?: string; onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(lastError ?? null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await window.electronDesktopActivation!.activate({
        activationCode: code.trim(),
        deviceName: deviceName.trim() || undefined,
      });
      if (!res.ok) {
        setErr(res.message || 'Activation failed.');
        return;
      }
      onSuccess();
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormShell
      title="Activate Nezhin POS Desktop"
      subtitle="Enter the activation code from your purchase email. The desktop only contacts our license server during this one-time activation."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1">
          <FieldLabel>Activation code</FieldLabel>
          <input
            type="text"
            className="w-full rounded-md border border-stroke bg-canvas px-3 py-2 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="space-y-1">
          <FieldLabel>Device name (optional)</FieldLabel>
          <input
            type="text"
            placeholder="e.g. Front Counter"
            className="w-full rounded-md border border-stroke bg-canvas px-3 py-2 text-sm"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
          />
        </div>
        {err && <p className="text-sm text-danger-600">{err}</p>}
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="w-full rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Activating…' : 'Activate'}
        </button>
      </form>
    </FormShell>
  );
}

function OwnerSetupForm({
  activation,
  lastError,
  onSuccess,
}: {
  activation: Extract<ActivationStatus, { activated: true }>;
  lastError?: string;
  onSuccess: () => void;
}) {
  const [ownerName, setOwnerName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(lastError ?? null);

  const mismatch = useMemo(() => password.length > 0 && confirm.length > 0 && password !== confirm, [password, confirm]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (mismatch) {
      setErr('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/auth/owner/setup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          license: {
            clientId: activation.clientId,
            businessName: activation.businessName,
            businessType: activation.businessType,
            ownerEmail: activation.ownerEmail,
            ownerName: ownerName.trim() || undefined,
            planCode: activation.planCode,
            lifetimeLicense: activation.lifetimeLicense,
          },
          password,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string; code?: string } | null;
        if (res.status === 403 && body?.code === 'NOT_DESKTOP_MODE') {
          setErr('This installation is not running in desktop mode.');
          return;
        }
        setErr(body?.message || `Setup failed (HTTP ${res.status}).`);
        return;
      }
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Network error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormShell
      title="Create your local owner account"
      subtitle={`Activated for ${activation.businessName || 'your store'}. Choose a password you'll use to sign in offline.`}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1">
          <FieldLabel>Owner email</FieldLabel>
          <input
            type="email"
            value={activation.ownerEmail || ''}
            disabled
            className="w-full rounded-md border border-stroke bg-canvas px-3 py-2 text-sm opacity-70"
          />
        </div>
        <div className="space-y-1">
          <FieldLabel>Display name (optional)</FieldLabel>
          <input
            type="text"
            className="w-full rounded-md border border-stroke bg-canvas px-3 py-2 text-sm"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <FieldLabel>Password</FieldLabel>
          <input
            type="password"
            className="w-full rounded-md border border-stroke bg-canvas px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="space-y-1">
          <FieldLabel>Confirm password</FieldLabel>
          <input
            type="password"
            className="w-full rounded-md border border-stroke bg-canvas px-3 py-2 text-sm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        {err && <p className="text-sm text-danger-600">{err}</p>}
        <button
          type="submit"
          disabled={busy || mismatch || password.length < 8}
          className="w-full rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Creating…' : 'Create owner account'}
        </button>
      </form>
    </FormShell>
  );
}
