import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { fetchStoreSettings } from '@/api/settings.api';
import { useStoreAuthReady } from '@/hooks/use-store-auth-ready';
import { formatMoney } from '@/lib/format-money';
import { posOfflineDb } from '@/offline/pos-db';
import type { ReceiptPaperSize, StoreSettings } from '@/types/store-settings';

function normalizeStoreSettings(raw: Partial<StoreSettings> | undefined): StoreSettings | undefined {
  if (!raw || typeof raw !== 'object' || !raw.id) return undefined;
  const copies = Number(raw.receiptCopies);
  return {
    ...(raw as StoreSettings),
    receiptPaperSize: (raw.receiptPaperSize === 'MM58' ? 'MM58' : 'MM80') as ReceiptPaperSize,
    receiptAutoPrint: Boolean(raw.receiptAutoPrint),
    receiptCopies: Number.isFinite(copies) ? Math.min(10, Math.max(1, Math.trunc(copies))) : 1,
    receiptShowLogo: raw.receiptShowLogo !== false,
    receiptPrinterName: raw.receiptPrinterName ?? null,
    refundApprovalMethod:
      raw.refundApprovalMethod === 'NFC_CARD' || raw.refundApprovalMethod === 'NFC_CARD_AND_PIN'
        ? raw.refundApprovalMethod
        : 'APPROVAL_ID',
  };
}

function parseSettingsRow(row: { payload: string } | undefined): StoreSettings | undefined {
  if (!row) return undefined;
  try {
    return normalizeStoreSettings(JSON.parse(row.payload) as Partial<StoreSettings>);
  } catch {
    return undefined;
  }
}

export function useStoreSettings() {
  const authReady = useStoreAuthReady();
  const cachedRow = useLiveQuery(() => posOfflineDb.settings.get('store'), []);
  const cachedSettings = useMemo(() => parseSettingsRow(cachedRow), [cachedRow]);

  const query = useQuery({
    queryKey: ['store-settings'],
    queryFn: async () => {
      const s = await fetchStoreSettings();
      return normalizeStoreSettings(s) ?? (s as StoreSettings);
    },
    staleTime: 30_000,
    enabled: authReady,
  });

  const settings = query.data ?? cachedSettings;

  const currency = (settings?.currency ?? 'USD').trim().toUpperCase() || 'USD';

  const format = useCallback(
    (value: Parameters<typeof formatMoney>[0]) => formatMoney(value, currency),
    [currency],
  );

  const taxRateNum = useMemo(() => {
    const r = settings?.taxRate;
    if (r === undefined || r === null) return 0;
    return typeof r === 'number' ? r : Number(r);
  }, [settings?.taxRate]);

  const taxAuto = Boolean(settings?.taxEnabled && taxRateNum > 0);

  return {
    ...query,
    data: settings,
    settings,
    currency,
    formatMoney: format,
    taxRateNum,
    taxAuto,
  };
}
