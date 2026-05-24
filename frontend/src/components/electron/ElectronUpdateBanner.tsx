import { useEffect, useState } from 'react';
import { useElectronUpdater } from '@/components/electron/ElectronUpdaterProvider';
import { isElectronUpdaterAvailable } from '@/lib/electron-updater';
import { tryQuitAndInstallForUpdate } from '@/lib/electron-update-restart';
import { Button } from '@/components/ui/button';

export function ElectronUpdateBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { payload } = useElectronUpdater();

  useEffect(() => {
    if (payload.phase !== 'downloaded') {
      setDismissed(false);
    }
  }, [payload.phase]);

  if (!isElectronUpdaterAvailable() || dismissed || payload.phase !== 'downloaded') {
    return null;
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-success-300 bg-success-50 px-4 py-3 text-sm text-success-900 sm:flex-row sm:items-center sm:justify-between">
      <p>
        <span className="font-semibold">Update ready.</span>{' '}
        {payload.version ? `Version ${payload.version} is downloaded.` : 'A new version is downloaded.'} Restart when
        convenient — active sales are protected until you confirm.
      </p>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" size="sm" variant="primary" onClick={() => void tryQuitAndInstallForUpdate()}>
          Restart now
        </Button>
        <Button type="button" size="sm" variant="ghost" className="text-success-800" onClick={() => setDismissed(true)}>
          Later
        </Button>
      </div>
    </div>
  );
}
