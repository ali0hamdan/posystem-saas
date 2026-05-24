import { toast } from 'sonner';
import { countUnsyncedOfflineSaleQueue } from '@/offline/unsynced-offline-sales';
import { isElectronUpdaterAvailable } from '@/lib/electron-updater';
import { usePosSaleSessionStore } from '@/stores/pos-sale-session-store';

/**
 * Restarts the desktop shell to apply a downloaded update.
 * Blocks when a POS session is active; requires confirmation if offline sales are pending.
 */
export async function tryQuitAndInstallForUpdate(): Promise<void> {
  if (!isElectronUpdaterAvailable()) return;

  if (usePosSaleSessionStore.getState().sessionActive) {
    toast.error('Finish or clear the current sale before restarting for an update.');
    return;
  }

  const pending = await countUnsyncedOfflineSaleQueue();
  if (pending > 0) {
    const ok = window.confirm(
      `You have ${pending} offline sale(s) that are not fully synced to the server. Restart now anyway?`,
    );
    if (!ok) return;
  }

  try {
    const r = await window.electronUpdater!.quitAndInstall();
    if (r?.skipped) {
      toast.message('Install updates from a packaged release build.');
      return;
    }
    if (r && r.ok === false && r.message) {
      toast.error(r.message);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Restart failed';
    toast.error(msg);
  }
}
