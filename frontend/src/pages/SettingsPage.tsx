import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchStoreSettings, patchStoreSettings } from '@/api/settings.api';
import { getApiErrorMessage } from '@/api/client';
import type { PatchStoreSettingsBody } from '@/types/store-settings';
import { getElectronPrinters, isElectronPrintAvailable } from '@/lib/electron-print';
import { ElectronUpdatePanel } from '@/components/electron/ElectronUpdatePanel';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';

declare const __STOCK_POS_VERSION__: string | undefined;

type FormValues = {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  receiptFooter: string;
  taxEnabled: boolean;
  taxRate: string;
  currency: string;
  lowStockDefault: string;
  receiptLogo: string;
  receiptPaperSize: 'MM58' | 'MM80';
  receiptAutoPrint: boolean;
  receiptCopies: string;
  receiptShowLogo: boolean;
  receiptPrinterName: string;
};

function toPatchBody(v: FormValues): PatchStoreSettingsBody {
  const taxRate = Number(v.taxRate);
  const lowStockDefault = Math.trunc(Number(v.lowStockDefault));
  const copies = Math.trunc(Number(v.receiptCopies));
  return {
    storeName: v.storeName.trim(),
    storePhone: v.storePhone.trim() === '' ? null : v.storePhone.trim(),
    storeAddress: v.storeAddress.trim() === '' ? null : v.storeAddress.trim(),
    receiptFooter: v.receiptFooter.trim() === '' ? null : v.receiptFooter.trim(),
    taxEnabled: v.taxEnabled,
    taxRate: Number.isFinite(taxRate) ? taxRate : 0,
    currency: v.currency.trim().toUpperCase().slice(0, 3),
    lowStockDefault: Number.isFinite(lowStockDefault) ? Math.max(0, lowStockDefault) : 0,
    receiptLogo: v.receiptLogo.trim() === '' ? null : v.receiptLogo.trim(),
    receiptPaperSize: v.receiptPaperSize === 'MM58' ? 'MM58' : 'MM80',
    receiptAutoPrint: v.receiptAutoPrint,
    receiptCopies: Number.isFinite(copies) ? Math.min(10, Math.max(1, copies)) : 1,
    receiptShowLogo: v.receiptShowLogo,
    receiptPrinterName: v.receiptPrinterName.trim() === '' ? null : v.receiptPrinterName.trim(),
  };
}

const inputClass =
  'w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const electronPrint = isElectronPrintAvailable();
  const printersQuery = useQuery({
    queryKey: ['electron-printers'],
    queryFn: getElectronPrinters,
    enabled: electronPrint,
    staleTime: 60_000,
  });

  const settingsQuery = useQuery({
    queryKey: ['store-settings'],
    queryFn: fetchStoreSettings,
  });

  const form = useForm<FormValues>({
    defaultValues: {
      storeName: '',
      storePhone: '',
      storeAddress: '',
      receiptFooter: '',
      taxEnabled: false,
      taxRate: '0',
      currency: 'USD',
      lowStockDefault: '5',
      receiptLogo: '',
      receiptPaperSize: 'MM80',
      receiptAutoPrint: false,
      receiptCopies: '1',
      receiptShowLogo: true,
      receiptPrinterName: '',
    },
  });

  useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    form.reset({
      storeName: s.storeName,
      storePhone: s.storePhone ?? '',
      storeAddress: s.storeAddress ?? '',
      receiptFooter: s.receiptFooter ?? '',
      taxEnabled: s.taxEnabled,
      taxRate: String(typeof s.taxRate === 'number' ? s.taxRate : Number(s.taxRate)),
      currency: s.currency,
      lowStockDefault: String(s.lowStockDefault),
      receiptLogo: s.receiptLogo ?? '',
      receiptPaperSize: s.receiptPaperSize === 'MM58' ? 'MM58' : 'MM80',
      receiptAutoPrint: s.receiptAutoPrint,
      receiptCopies: String(s.receiptCopies),
      receiptShowLogo: s.receiptShowLogo,
      receiptPrinterName: s.receiptPrinterName ?? '',
    });
  }, [settingsQuery.data, form]);

  const mutation = useMutation({
    mutationFn: patchStoreSettings,
    onSuccess: () => {
      toast.success('Settings saved');
      void queryClient.invalidateQueries({ queryKey: ['store-settings'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not save settings'));
    },
  });

  function onSubmit(values: FormValues) {
    if (!/^[A-Za-z]{3}$/.test(values.currency.trim())) {
      toast.error('Currency must be a 3-letter code (e.g. USD).');
      return;
    }
    const tr = Number(values.taxRate);
    if (values.taxEnabled && (!Number.isFinite(tr) || tr < 0 || tr > 100)) {
      toast.error('Tax rate must be between 0 and 100 when tax is enabled.');
      return;
    }
    const logo = values.receiptLogo.trim();
    if (logo && !/^https?:\/\//i.test(logo)) {
      toast.error('Receipt logo must be an http(s) URL.');
      return;
    }
    const rc = Math.trunc(Number(values.receiptCopies));
    if (!Number.isFinite(rc) || rc < 1 || rc > 10) {
      toast.error('Receipt copies must be between 1 and 10.');
      return;
    }
    mutation.mutate(toPatchBody(values));
  }

  const busy = mutation.isPending || settingsQuery.isLoading;

  const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-muted';

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-10">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">Store settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Receipt branding, thermal paper width, optional auto-print on the POS, tax defaults, currency display, and
          new-product minimum stock. Cashiers can read these values; only owners and administrators can change them.
        </p>
      </div>

      {settingsQuery.isError ? (
        <ErrorBanner message={getApiErrorMessage(settingsQuery.error, 'Could not load settings.')} />
      ) : (
        <>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
              <h2 className="font-display text-lg font-semibold text-ink">Store profile</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="ss-name" className={labelClass}>Store name</label>
                  <input id="ss-name" className={inputClass} {...form.register('storeName', { required: true })} />
                </div>
                <div>
                  <label htmlFor="ss-phone" className={labelClass}>Store phone</label>
                  <input id="ss-phone" className={inputClass} {...form.register('storePhone')} />
                </div>
                <div>
                  <label htmlFor="ss-address" className={labelClass}>Store address</label>
                  <textarea id="ss-address" rows={3} className={inputClass} {...form.register('storeAddress')} />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
              <h2 className="font-display text-lg font-semibold text-ink">Receipt</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="ss-footer" className={labelClass}>Receipt footer</label>
                  <textarea
                    id="ss-footer"
                    rows={3}
                    placeholder="Thank you · returns policy · website"
                    className={inputClass}
                    {...form.register('receiptFooter')}
                  />
                </div>
                <div>
                  <label htmlFor="ss-paper" className={labelClass}>Receipt paper width</label>
                  <select id="ss-paper" className={`${inputClass} max-w-xs`} {...form.register('receiptPaperSize')}>
                    <option value="MM80">80mm thermal</option>
                    <option value="MM58">58mm thermal</option>
                  </select>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="rounded border-line text-primary-500" {...form.register('receiptAutoPrint')} />
                  Auto-print receipt after each sale (POS)
                </label>
                <div>
                  <label htmlFor="ss-copies" className={labelClass}>Receipt copies per print (1–10)</label>
                  <input
                    id="ss-copies"
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    className={`${inputClass} max-w-[8rem]`}
                    {...form.register('receiptCopies')}
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="rounded border-line text-primary-500" {...form.register('receiptShowLogo')} />
                  Show logo on receipt (when a logo URL is set)
                </label>
                {electronPrint ? (
                  <div>
                    <label htmlFor="ss-printer" className={labelClass}>Default thermal printer (Electron)</label>
                    <select
                      id="ss-printer"
                      className={inputClass}
                      disabled={printersQuery.isLoading}
                      {...form.register('receiptPrinterName')}
                    >
                      <option value="">System default</option>
                      {(printersQuery.data ?? []).map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.displayName?.trim() || p.name}
                        </option>
                      ))}
                    </select>
                    {printersQuery.isError ? (
                      <p className="mt-1 text-xs text-warning-700">Could not list printers. You can still type the device name.</p>
                    ) : null}
                  </div>
                ) : null}
                <div>
                  <label htmlFor="ss-logo" className={labelClass}>
                    Receipt logo URL <span className="font-normal text-ink-faint">(optional, https)</span>
                  </label>
                  <input
                    id="ss-logo"
                    type="url"
                    placeholder="https://…"
                    className={inputClass}
                    {...form.register('receiptLogo')}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
              <h2 className="font-display text-lg font-semibold text-ink">Tax & currency</h2>
              <div className="mt-4 space-y-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="rounded border-line text-primary-500" {...form.register('taxEnabled')} />
                  Enable sales tax (applied on discounted subtotal; POS updates automatically)
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ss-tax" className={labelClass}>Tax rate (%)</label>
                    <input
                      id="ss-tax"
                      type="number"
                      min={0}
                      max={100}
                      step="0.0001"
                      className={inputClass}
                      {...form.register('taxRate')}
                    />
                  </div>
                  <div>
                    <label htmlFor="ss-currency" className={labelClass}>Currency (ISO 4217)</label>
                    <input
                      id="ss-currency"
                      maxLength={3}
                      className={`${inputClass} font-mono uppercase`}
                      {...form.register('currency')}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
              <h2 className="font-display text-lg font-semibold text-ink">Inventory defaults</h2>
              <div className="mt-4">
                <label htmlFor="ss-min" className={labelClass}>Default minimum stock for new products</label>
                <input
                  id="ss-min"
                  type="number"
                  min={0}
                  step={1}
                  className={`${inputClass} max-w-xs`}
                  {...form.register('lowStockDefault')}
                />
              </div>
            </section>

            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="lg" disabled={busy}>
                {busy ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          </form>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
            <h2 className="font-display text-lg font-semibold text-ink">About</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Build identifier for this UI (same in the browser and the packaged desktop shell).
            </p>
            <p className="mt-3 font-mono text-sm text-ink">
              {typeof __STOCK_POS_VERSION__ !== 'undefined' ? __STOCK_POS_VERSION__ : '—'}
            </p>
          </section>

          <ElectronUpdatePanel />
        </>
      )}
    </div>
  );
}
