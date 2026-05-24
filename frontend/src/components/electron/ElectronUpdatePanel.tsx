import { useState } from 'react';
import { toast } from 'sonner';
import { useElectronUpdater } from '@/components/electron/ElectronUpdaterProvider';
import { isElectronUpdaterAvailable } from '@/lib/electron-updater';
import { tryQuitAndInstallForUpdate } from '@/lib/electron-update-restart';
import { exportElectronLogs, isElectronDiagnosticsAvailable } from '@/lib/electron-diagnostics-bridge';
import { Button } from '@/components/ui/button';

declare const __STOCK_POS_VERSION__: string | undefined;

function appUiVersion(): string {
  return typeof __STOCK_POS_VERSION__ !== 'undefined' ? __STOCK_POS_VERSION__ : '—';
}

function statusLabel(payload: ReturnType<typeof useElectronUpdater>['payload']): string {
  switch (payload.phase) {
    case 'checking':
      return 'Checking for updates…';
    case 'available':
      return payload.version ? `Update available (v${payload.version})` : 'Update available';
    case 'downloading':
      return payload.percent != null
        ? `Downloading update… ${Math.round(payload.percent)}%`
        : 'Downloading update…';
    case 'downloaded':
      return payload.version ? `Update ready — v${payload.version}` : 'Update ready to install';
    case 'not-available':
      return 'App is up to date';
    case 'error':
      return 'Update failed';
    case 'idle':
    default:
      return payload.message?.trim() ? payload.message : 'Idle';
  }
}

export function ElectronUpdatePanel() {
  const { payload, versions, checkNow } = useElectronUpdater();
  const [exportBusy, setExportBusy] = useState(false);

  if (!isElectronUpdaterAvailable() && !isElectronDiagnosticsAvailable()) {
    return null;
  }

  async function onExportLogs() {
    setExportBusy(true);
    try {
      const r = await exportElectronLogs();
      if (r.ok && r.path) {
        toast.success('Logs exported', { description: r.path });
      } else if (!r.canceled) {
        toast.error(r.message ?? 'Could not export logs');
      }
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
      <h2 className="font-display text-lg font-semibold text-ink">Desktop app & updates</h2>
      <p className="mt-2 text-sm text-ink-muted">
        This section appears only in the Electron desktop build. Updates download in the background; the app only
        restarts when you choose.
      </p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">UI bundle version</dt>
          <dd className="mt-1 font-mono text-ink">{appUiVersion()}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Shell version</dt>
          <dd className="mt-1 font-mono text-ink">{versions?.shell ?? '…'}</dd>
        </div>
      </dl>

      {isElectronDiagnosticsAvailable() ? (
        <div className="mt-5 rounded-xl border border-line bg-canvas px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Diagnostics</p>
          <p className="mt-1 text-sm text-ink-muted">
            Local logs include startup, update checks, sync failures, and print errors. Export a copy for support.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            disabled={exportBusy}
            onClick={() => void onExportLogs()}
          >
            {exportBusy ? 'Exporting…' : 'Export logs'}
          </Button>
        </div>
      ) : null}

      {isElectronUpdaterAvailable() ? (
        <>
          <div className="mt-5 rounded-xl border border-line bg-canvas px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Update status</p>
            <p className="mt-1 text-sm text-ink">{statusLabel(payload)}</p>
            {payload.phase === 'error' && payload.message ? (
              <p className="mt-2 text-sm text-danger-600">{payload.message}</p>
            ) : null}
            {payload.phase === 'idle' && payload.message ? (
              <p className="mt-2 text-sm text-ink-muted">{payload.message}</p>
            ) : null}
            {payload.phase === 'downloading' && payload.bytesPerSecond != null ? (
              <p className="mt-1 text-xs text-ink-faint">
                {Math.round(payload.bytesPerSecond / 1024)} KB/s
                {payload.total != null
                  ? ` · ${Math.round((payload.transferred ?? 0) / 1024)} / ${Math.round(payload.total / 1024)} KB`
                  : null}
              </p>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={payload.phase === 'checking'}
              onClick={() => void checkNow()}
            >
              Check for updates
            </Button>
            {payload.phase === 'downloaded' ? (
              <Button type="button" variant="primary" onClick={() => void tryQuitAndInstallForUpdate()}>
                Restart to update
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
