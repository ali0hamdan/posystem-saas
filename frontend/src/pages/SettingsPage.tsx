import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BellRing } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchStoreSettings, patchStoreSettings } from '@/api/settings.api';
import { getApiErrorMessage } from '@/api/client';
import type { PatchStoreSettingsBody, RefundApprovalMethod } from '@/types/store-settings';
import { useAuthStore } from '@/stores/auth-store';
import { getElectronPrinters, isElectronPrintAvailable } from '@/lib/electron-print';
import { ElectronUpdatePanel } from '@/components/electron/ElectronUpdatePanel';
import { DesktopBackupPanel } from '@/components/electron/DesktopBackupPanel';
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
  quotationPrefix: string;
  proformaPrefix: string;
  invoicePrefix: string;
  deliveryNotePrefix: string;
  defaultPaymentTermsDays: string;
  showTaxOnQuotation: boolean;
  showSignatureArea: boolean;
  enableCustomerCredit: boolean;
  enableDeliveryNotes: boolean;
  enableApprovalWorkflow: boolean;
  allowOverCreditOverride: boolean;
  allowOverStockOverride: boolean;
  emailNotificationsEnabled: boolean;
  refundApprovalMethod: RefundApprovalMethod;
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
    quotationPrefix: v.quotationPrefix.trim().toUpperCase(),
    proformaPrefix: v.proformaPrefix.trim().toUpperCase(),
    invoicePrefix: v.invoicePrefix.trim().toUpperCase(),
    deliveryNotePrefix: v.deliveryNotePrefix.trim().toUpperCase(),
    defaultPaymentTermsDays: Math.max(0, Math.trunc(Number(v.defaultPaymentTermsDays) || 0)),
    showTaxOnQuotation: v.showTaxOnQuotation,
    showSignatureArea: v.showSignatureArea,
    enableCustomerCredit: v.enableCustomerCredit,
    enableDeliveryNotes: v.enableDeliveryNotes,
    enableApprovalWorkflow: v.enableApprovalWorkflow,
    allowOverCreditOverride: v.allowOverCreditOverride,
    allowOverStockOverride: v.allowOverStockOverride,
    emailNotificationsEnabled: v.emailNotificationsEnabled,
    ...(v.refundApprovalMethod ? { refundApprovalMethod: v.refundApprovalMethod } : {}),
  };
}

const inputClass =
  'w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/25';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const isOwner = me?.role === 'OWNER';
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
      quotationPrefix: 'Q',
      proformaPrefix: 'PI',
      invoicePrefix: 'INV',
      deliveryNotePrefix: 'DN',
      defaultPaymentTermsDays: '30',
      showTaxOnQuotation: true,
      showSignatureArea: false,
      enableCustomerCredit: true,
      enableDeliveryNotes: true,
      enableApprovalWorkflow: false,
      allowOverCreditOverride: false,
      allowOverStockOverride: false,
      emailNotificationsEnabled: true,
      refundApprovalMethod: 'APPROVAL_ID' as RefundApprovalMethod,
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
      quotationPrefix: s.quotationPrefix ?? 'Q',
      proformaPrefix: s.proformaPrefix ?? 'PI',
      invoicePrefix: s.invoicePrefix ?? 'INV',
      deliveryNotePrefix: s.deliveryNotePrefix ?? 'DN',
      defaultPaymentTermsDays: String(s.defaultPaymentTermsDays ?? 30),
      showTaxOnQuotation: s.showTaxOnQuotation ?? true,
      showSignatureArea: s.showSignatureArea ?? false,
      enableCustomerCredit: s.enableCustomerCredit ?? true,
      enableDeliveryNotes: s.enableDeliveryNotes ?? true,
      enableApprovalWorkflow: s.enableApprovalWorkflow ?? false,
      allowOverCreditOverride: s.allowOverCreditOverride ?? false,
      allowOverStockOverride: s.allowOverStockOverride ?? false,
      emailNotificationsEnabled: s.emailNotificationsEnabled ?? true,
      refundApprovalMethod: s.refundApprovalMethod ?? 'APPROVAL_ID',
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
              <h2 className="font-display text-lg font-semibold text-ink">Wholesale / B2B</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Document numbering, payment terms, and workflow toggles for quotations, proforma invoices, and delivery notes.
              </p>
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label htmlFor="ss-q-prefix" className={labelClass}>Quotation prefix</label>
                    <input id="ss-q-prefix" maxLength={8} className={inputClass} {...form.register('quotationPrefix')} />
                  </div>
                  <div>
                    <label htmlFor="ss-pi-prefix" className={labelClass}>Proforma prefix</label>
                    <input id="ss-pi-prefix" maxLength={8} className={inputClass} {...form.register('proformaPrefix')} />
                  </div>
                  <div>
                    <label htmlFor="ss-inv-prefix" className={labelClass}>Invoice prefix</label>
                    <input id="ss-inv-prefix" maxLength={8} className={inputClass} {...form.register('invoicePrefix')} />
                  </div>
                  <div>
                    <label htmlFor="ss-dn-prefix" className={labelClass}>Delivery note prefix</label>
                    <input id="ss-dn-prefix" maxLength={8} className={inputClass} {...form.register('deliveryNotePrefix')} />
                  </div>
                </div>
                <div>
                  <label htmlFor="ss-terms-days" className={labelClass}>Default payment terms (days)</label>
                  <input
                    id="ss-terms-days"
                    type="number"
                    min={0}
                    max={3650}
                    className={`${inputClass} max-w-xs`}
                    {...form.register('defaultPaymentTermsDays')}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input type="checkbox" className="rounded border-line text-primary-500" {...form.register('showTaxOnQuotation')} />
                    Show tax on quotations
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input type="checkbox" className="rounded border-line text-primary-500" {...form.register('showSignatureArea')} />
                    Show signature area on B2B documents
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input type="checkbox" className="rounded border-line text-primary-500" {...form.register('enableCustomerCredit')} />
                    Enable customer credit limits
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input type="checkbox" className="rounded border-line text-primary-500" {...form.register('enableDeliveryNotes')} />
                    Enable delivery notes
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input type="checkbox" className="rounded border-line text-primary-500" {...form.register('enableApprovalWorkflow')} />
                    Require approval workflow for large orders
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input type="checkbox" className="rounded border-line text-primary-500" {...form.register('allowOverCreditOverride')} />
                    Allow managers to override credit limits
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input type="checkbox" className="rounded border-line text-primary-500" {...form.register('allowOverStockOverride')} />
                    Allow managers to override stock reservations
                  </label>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
              <h2 className="font-display text-lg font-semibold text-ink">Email notifications</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Choose who receives email notifications for each business event on the Notification
                Settings page. The toggle below is a master switch for all notification emails.
              </p>
              <div className="mt-4 space-y-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="rounded border-line text-primary-500" {...form.register('emailNotificationsEnabled')} />
                  Enable email notifications
                </label>
                <Link
                  to="notifications"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline"
                >
                  <BellRing className="h-4 w-4" />
                  Configure notification recipients
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-surface p-5 shadow-card md:p-6">
              <h2 className="font-display text-lg font-semibold text-ink">Refund approval</h2>
              <p className="mt-1 text-sm text-ink-muted">
                Choose how managers authorize refunds. NFC Card + PIN is recommended for sensitive POS actions.
                {!isOwner ? ' Only the owner can change this setting.' : ''}
              </p>
              <div className="mt-4 max-w-md">
                <label htmlFor="ss-refund-approval" className={labelClass}>
                  Refund approval method
                </label>
                <select
                  id="ss-refund-approval"
                  className={inputClass}
                  disabled={!isOwner || busy}
                  {...form.register('refundApprovalMethod')}
                >
                  <option value="APPROVAL_ID">Approval ID</option>
                  <option value="NFC_CARD">NFC Card</option>
                  <option value="NFC_CARD_AND_PIN">NFC Card + PIN</option>
                </select>
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

          <DesktopBackupPanel />
          <ElectronUpdatePanel />
        </>
      )}
    </div>
  );
}
