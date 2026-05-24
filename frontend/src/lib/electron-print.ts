/**
 * Optional bridge when the app is hosted inside Electron with a preload that
 * exposes `window.electronPrint`. The web build stays unchanged if undefined.
 */
export type ElectronPrinterInfo = {
  name: string;
  displayName?: string;
};

export type ElectronPrintSilentResult = { ok: boolean; error?: string };

export function isElectronPrintAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronPrint?.printSilent);
}

export async function getElectronPrinters(): Promise<ElectronPrinterInfo[]> {
  const ep = window.electronPrint;
  if (!ep?.getPrinters) return [];
  try {
    return await ep.getPrinters();
  } catch {
    return [];
  }
}

export async function printReceiptViaElectron(opts: {
  copies: number;
  deviceName?: string;
}): Promise<{ handled: boolean }> {
  const ep = window.electronPrint;
  if (!ep?.printSilent) return { handled: false };

  const copies = Math.min(10, Math.max(1, opts.copies));
  for (let i = 0; i < copies; i += 1) {
    try {
      const r: ElectronPrintSilentResult = await ep.printSilent({
        silent: true,
        deviceName: opts.deviceName,
      });
      if (!r?.ok) {
        console.warn('[electronPrint]', r?.error ?? 'printSilent failed');
      }
    } catch (e) {
      console.warn('[electronPrint]', e);
    }
  }
  return { handled: true };
}
