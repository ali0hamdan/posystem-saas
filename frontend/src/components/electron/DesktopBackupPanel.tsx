import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { IS_DESKTOP_APP } from '@/lib/env';
import { Button } from '@/components/ui/button';

type BackupEntry = {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * Desktop-only Settings card for local PostgreSQL backup / restore.
 *
 *   - Renders nothing in web SaaS (no `electronDesktopBackup` bridge).
 *   - Restore requires an explicit confirmation modal AND passes
 *     `{ confirm: true }` through the IPC bridge, matching the
 *     main-process guard in local-backup-manager.cjs.
 */
export function DesktopBackupPanel() {
  const enabled = IS_DESKTOP_APP && typeof window.electronDesktopBackup !== 'undefined';
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<BackupEntry | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const list = (await window.electronDesktopBackup!.listBackups()) as BackupEntry[];
      setBackups(list);
    } catch (e) {
      console.warn('[backup] listBackups failed', e);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!enabled) return null;

  async function onExport() {
    setBusy('export');
    try {
      const res = await window.electronDesktopBackup!.exportBackup();
      if (res.ok) {
        toast.success('Backup exported.');
      } else {
        toast.error(res.error || 'Backup failed.');
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onConfirmRestore() {
    if (!confirmRestore) return;
    setBusy('restore');
    try {
      const res = await window.electronDesktopBackup!.restoreBackup({
        filePath: confirmRestore.path,
        confirm: true,
      });
      if (res.ok) {
        toast.success('Restore completed. A safety snapshot of the previous data was saved.');
      } else if (res.canceled) {
        // user cancelled the file picker — no-op
      } else {
        toast.error(res.error || 'Restore failed.');
      }
      setConfirmRestore(null);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-stroke bg-surface p-5 shadow-sm">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Local backups</h2>
          <p className="text-sm text-ink-muted">
            Exports a PostgreSQL dump of your local database. Backups are stored on this machine
            only.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={busy !== null} onClick={onExport}>
            {busy === 'export' ? 'Exporting…' : 'Export backup'}
          </Button>
        </div>
      </header>

      {backups.length === 0 ? (
        <p className="text-sm text-ink-muted">No backups yet. Export one to populate this list.</p>
      ) : (
        <ul className="divide-y divide-stroke">
          {backups.map((b) => (
            <li key={b.path} className="flex items-center justify-between py-2 gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-ink">{b.name}</div>
                <div className="text-xs text-ink-muted">
                  {formatBytes(b.size)} · {formatDate(b.modifiedAt)}
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={busy !== null}
                onClick={() => setConfirmRestore(b)}
              >
                Restore
              </Button>
            </li>
          ))}
        </ul>
      )}

      {confirmRestore && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="restore-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        >
          <div className="w-full max-w-md rounded-xl bg-surface p-5 shadow-lg">
            <h3 id="restore-confirm-title" className="text-base font-semibold text-ink">
              Restore from backup?
            </h3>
            <p className="mt-2 text-sm text-ink-muted">
              <strong>This will replace current local data.</strong> A safety snapshot of the
              current database is written before restore — but you should still confirm this is
              the backup you want.
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              File: <span className="font-mono">{confirmRestore.name}</span>
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy === 'restore'}
                onClick={() => setConfirmRestore(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={busy === 'restore'}
                onClick={onConfirmRestore}
              >
                {busy === 'restore' ? 'Restoring…' : 'Replace local data'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
