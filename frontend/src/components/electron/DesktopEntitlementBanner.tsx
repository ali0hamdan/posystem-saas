import { useEffect, useState } from 'react';
import { IS_DESKTOP_APP } from '@/lib/env';

type Entitlements = {
  supportActive: boolean | null;
  cloudHostingActive: boolean | null;
  updatesActive: boolean | null;
};

type ActivationStatus =
  | { activated: false }
  | {
      activated: true;
      entitlements: Entitlements;
    };

type Notice = { kind: 'cloud' | 'updates' | 'support'; tone: 'warn' | 'info'; text: string };

function noticesFor(ent: Entitlements): Notice[] {
  const out: Notice[] = [];
  if (ent.cloudHostingActive === false) {
    out.push({
      kind: 'cloud',
      tone: 'info',
      text: 'Cloud hosting expired. Your desktop app still works offline.',
    });
  }
  if (ent.updatesActive === false) {
    out.push({
      kind: 'updates',
      tone: 'warn',
      text: 'Updates expired. Renew your Desktop Care Plan to receive new updates.',
    });
  }
  if (ent.supportActive === false) {
    out.push({
      kind: 'support',
      tone: 'info',
      text: 'Support plan expired — paid support requests are no longer available.',
    });
  }
  return out;
}

export function DesktopEntitlementBanner() {
  const enabled = IS_DESKTOP_APP && typeof window.electronDesktopActivation !== 'undefined';
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const status = (await window.electronDesktopActivation!.getStatus()) as ActivationStatus;
      if (cancelled || !status.activated) return;
      setNotices(noticesFor(status.entitlements));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!enabled || notices.length === 0) return null;

  return (
    <div className="mb-3 flex flex-col gap-2">
      {notices.map((n) => (
        <div
          key={n.kind}
          className={
            n.tone === 'warn'
              ? 'rounded-md border border-warning-300 bg-warning-50 px-3 py-2 text-sm text-warning-700'
              : 'rounded-md border border-stroke bg-surface-muted px-3 py-2 text-sm text-ink-muted'
          }
          role="status"
        >
          {n.text}
        </div>
      ))}
    </div>
  );
}
