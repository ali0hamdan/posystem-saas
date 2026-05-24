import { useCallback, useEffect, useRef, useState } from 'react';
import { Printer, X } from 'lucide-react';
import { formatMoney } from '@/lib/format-money';
import { STORE_NAME } from '@/lib/env';
import { useStoreSettings } from '@/hooks/use-store-settings';
import { printReceiptViaElectron, isElectronPrintAvailable } from '@/lib/electron-print';
import type { CreatedSale } from '@/types/sales';
import type { ReceiptPaperSize } from '@/types/store-settings';
import { cn } from '@/lib/utils';

type PosReceiptModalProps = {
  sale: CreatedSale | null;
  open: boolean;
  onClose: () => void;
  /** Used when `sale.branch` is missing (e.g. older API payloads). */
  branchName?: string | null;
  /** When true, triggers a print shortly after the modal opens for a sale. */
  autoPrintOnOpen?: boolean;
};

export type ReceiptBranding = {
  storeName: string;
  storePhone?: string | null;
  storeAddress?: string | null;
  receiptFooter?: string | null;
  receiptLogo?: string | null;
  currency: string;
  receiptPaperSize: ReceiptPaperSize;
  receiptCopies: number;
  receiptShowLogo: boolean;
  receiptPrinterName?: string | null;
};

function num(v: string | number): number {
  return typeof v === 'number' ? v : Number(v);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function receiptAmountPaid(sale: CreatedSale): number {
  return (sale.payments ?? []).reduce((sum, p) => sum + num(p.amount), 0);
}

function receiptChange(sale: CreatedSale): number {
  return Math.max(0, round2(receiptAmountPaid(sale) - num(sale.total)));
}

function receiptPaperClass(paper: ReceiptPaperSize): string {
  return paper === 'MM58' ? 'receipt-paper-58mm' : 'receipt-paper-80mm';
}

function ReceiptScanBlock({ value, narrow }: { value: string; narrow: boolean }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const v = value.trim();
    if (!v) return;
    void import('qrcode').then((Q) => {
      const QR = Q.default;
      void QR.toDataURL(v, {
        width: narrow ? 92 : 108,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      }).then((url) => {
        if (!cancelled) setQrDataUrl(url);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [value, narrow]);

  useEffect(() => {
    const svg = svgRef.current;
    const v = value.trim();
    if (!svg || !v) return;
    let cancelled = false;
    void import('jsbarcode').then((JB) => {
      if (cancelled) return;
      const draw = JB.default ?? JB;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      try {
        draw(svg, v, {
          format: 'CODE128',
          displayValue: true,
          fontSize: narrow ? 7 : 8,
          height: narrow ? 20 : 26,
          width: narrow ? 0.9 : 1.1,
          margin: 0,
        });
      } catch {
        // Some invoice strings may not encode; QR still helps.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value, narrow]);

  if (!value.trim()) return null;

  return (
    <div className="receipt-scan-block mt-2 flex flex-col items-center gap-1 border-t border-dashed border-black pt-2">
      <svg ref={svgRef} className="max-w-full overflow-visible" aria-hidden />
      {qrDataUrl ? (
        <img src={qrDataUrl} alt="" width={narrow ? 92 : 108} height={narrow ? 92 : 108} className="h-auto max-w-[24mm]" />
      ) : null}
    </div>
  );
}

export function PosReceiptModal({
  sale,
  open,
  onClose,
  branchName: branchNameFallback,
  autoPrintOnOpen = false,
}: PosReceiptModalProps) {
  const autoPrintStartedForSaleId = useRef<string | null>(null);
  const { settings } = useStoreSettings();

  useEffect(() => {
    return () => {
      document.documentElement.classList.remove(
        'receipt-print-mode',
        'receipt-paper-58mm',
        'receipt-paper-80mm',
      );
    };
  }, []);

  useEffect(() => {
    if (!open) {
      autoPrintStartedForSaleId.current = null;
    }
  }, [open]);

  const handlePrint = useCallback(async () => {
    if (!sale) return;

    const paper = (settings?.receiptPaperSize === 'MM58' ? 'MM58' : 'MM80') as ReceiptPaperSize;
    const paperHtmlClass = receiptPaperClass(paper);
    const copies = Math.min(10, Math.max(1, Number(settings?.receiptCopies) || 1));
    const deviceName = settings?.receiptPrinterName?.trim() || undefined;

    if (isElectronPrintAvailable()) {
      const { handled } = await printReceiptViaElectron({ copies, deviceName });
      if (handled) return;
    }

    document.documentElement.classList.add('receipt-print-mode', paperHtmlClass);

    for (let i = 0; i < copies; i += 1) {
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          window.removeEventListener('afterprint', finish);
          resolve();
        };
        window.addEventListener('afterprint', finish);
        requestAnimationFrame(() => {
          window.print();
        });
        window.setTimeout(finish, 900);
      });
    }

    document.documentElement.classList.remove('receipt-print-mode', 'receipt-paper-58mm', 'receipt-paper-80mm');
  }, [sale, settings]);

  useEffect(() => {
    if (!open || !sale || !autoPrintOnOpen) return;
    if (autoPrintStartedForSaleId.current === sale.id) return;
    autoPrintStartedForSaleId.current = sale.id;
    const t = window.setTimeout(() => void handlePrint(), 400);
    return () => window.clearTimeout(t);
  }, [open, sale, autoPrintOnOpen, handlePrint]);

  if (!open || !sale) return null;

  const receipt = sale;
  const amountPaid = receiptAmountPaid(receipt);
  const change = receiptChange(receipt);

  const branding: ReceiptBranding | undefined = settings
    ? {
        storeName: settings.storeName,
        storePhone: settings.storePhone,
        storeAddress: settings.storeAddress,
        receiptFooter: settings.receiptFooter,
        receiptLogo: settings.receiptLogo,
        currency: settings.currency,
        receiptPaperSize: settings.receiptPaperSize,
        receiptCopies: settings.receiptCopies,
        receiptShowLogo: settings.receiptShowLogo,
        receiptPrinterName: settings.receiptPrinterName,
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <div className="relative z-[121] flex max-h-[90vh] w-full max-w-md flex-col rounded-t-2xl border border-line bg-surface shadow-soft sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-display text-lg font-semibold text-ink">Receipt</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handlePrint()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
            >
              <Printer className="h-4 w-4" aria-hidden />
              Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-ink-muted transition hover:bg-canvas hover:text-ink"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6">
          <ThermalReceiptBody
            sale={receipt}
            amountPaid={amountPaid}
            change={change}
            branding={branding}
            branchNameFallback={branchNameFallback}
          />
        </div>
      </div>
    </div>
  );
}

/** Isolated slip: same DOM is used for screen preview and browser print (see `index.css`). */
export function ThermalReceiptBody({
  sale,
  amountPaid,
  change,
  branding,
  branchNameFallback,
}: {
  sale: CreatedSale;
  amountPaid: number;
  change: number;
  branding?: ReceiptBranding | null;
  branchNameFallback?: string | null;
}) {
  const currency = (branding?.currency ?? 'USD').trim().toUpperCase() || 'USD';
  const storeName = branding?.storeName?.trim() || STORE_NAME;
  const fmt = (v: number | string) => formatMoney(v, currency);
  const paper: ReceiptPaperSize = branding?.receiptPaperSize === 'MM58' ? 'MM58' : 'MM80';
  const narrow = paper === 'MM58';
  const showLogo = Boolean(branding?.receiptShowLogo !== false && branding?.receiptLogo);
  const branchLabel = (sale.branch?.name ?? branchNameFallback ?? '').trim();

  const scanPayload = [sale.invoiceNumber, sale.id].filter(Boolean).join('|');

  return (
    <div
      id="thermal-receipt"
      className={cn(
        'thermal-receipt mx-auto bg-white p-3 leading-snug text-black shadow-sm sm:p-4',
        narrow ? 'w-[58mm] max-w-[58mm] text-[10px]' : 'w-[80mm] max-w-[80mm] text-[11px]',
      )}
    >
      <header className="border-b border-dashed border-black pb-2 text-center">
        {showLogo && branding?.receiptLogo ? (
          <img
            src={branding.receiptLogo}
            alt=""
            className={cn('mx-auto mb-1 object-contain', narrow ? 'max-h-12 max-w-[52mm]' : 'max-h-14 max-w-[70mm]')}
          />
        ) : null}
        <p className={cn('font-bold uppercase tracking-wide', narrow ? 'text-[11px]' : 'text-[13px]')}>{storeName}</p>
        {branchLabel ? (
          <p className="mt-0.5 font-mono text-[10px] text-neutral-700">Branch: {branchLabel}</p>
        ) : null}
        {branding?.storePhone ? (
          <p className="mt-0.5 font-mono text-[10px] text-neutral-700">{branding.storePhone}</p>
        ) : null}
        {branding?.storeAddress ? (
          <p
            className={cn(
              'mx-auto mt-0.5 whitespace-pre-wrap font-mono text-neutral-700',
              narrow ? 'max-w-[54mm] text-[8px]' : 'max-w-[72mm] text-[9px]',
            )}
          >
            {branding.storeAddress}
          </p>
        ) : null}
        <p className={cn('mt-1 font-mono font-semibold', narrow ? 'text-[10px]' : 'text-xs')}>{sale.invoiceNumber}</p>
        <p className="mt-0.5 font-mono text-[10px] text-neutral-700">{new Date(sale.createdAt).toLocaleString()}</p>
        {sale.cashier ? (
          <p className="mt-1 font-mono text-[10px] text-neutral-700">Cashier: {sale.cashier.name}</p>
        ) : null}
      </header>

      <section className="mt-2 border-b border-dashed border-black pb-2">
        <p className="mb-1 font-semibold uppercase tracking-wide">Items</p>
        {narrow ? (
          <table className="w-full border-collapse font-mono text-[9px]">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-0.5 pr-1 font-normal">Item</th>
                <th className="w-7 py-0.5 text-right font-normal">Qty</th>
                <th className="w-[3.5rem] py-0.5 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it) => (
                <tr key={it.id} className="align-top">
                  <td className="max-w-[34mm] py-1 pr-1 font-sans text-[9px] font-medium leading-tight">
                    <span className="block">{it.product.name}</span>
                    {num(it.discount) > 0 ? (
                      <span className="text-[8px] text-neutral-700">Disc {fmt(num(it.discount))}</span>
                    ) : null}
                  </td>
                  <td className="py-1 text-right tabular-nums">{it.quantity}</td>
                  <td className="py-1 text-right tabular-nums font-medium">{fmt(num(it.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full border-collapse font-mono text-[10px]">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-0.5 pr-1 font-normal">Item</th>
                <th className="w-8 py-0.5 text-right font-normal">Qty</th>
                <th className="w-[3.2rem] py-0.5 text-right font-normal">Unit</th>
                <th className="w-[3.2rem] py-0.5 text-right font-normal">Disc</th>
                <th className="w-[3.4rem] py-0.5 pl-0.5 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((it) => (
                <tr key={it.id} className="align-top">
                  <td className="max-w-[28mm] py-1 pr-1 font-sans text-[10px] font-medium leading-tight">
                    {it.product.name}
                  </td>
                  <td className="py-1 text-right tabular-nums">{it.quantity}</td>
                  <td className="py-1 text-right tabular-nums">{fmt(num(it.unitPrice))}</td>
                  <td className="py-1 text-right tabular-nums text-neutral-800">
                    {num(it.discount) > 0 ? fmt(num(it.discount)) : '—'}
                  </td>
                  <td className="py-1 pl-0.5 text-right tabular-nums font-medium">{fmt(num(it.total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={cn('mt-2 space-y-0.5 border-b border-dashed border-black pb-2 font-mono', narrow ? 'text-[9px]' : 'text-[10px]')}>
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{fmt(num(sale.subtotal))}</span>
        </div>
        <div className="flex justify-between">
          <span>Discounts</span>
          <span className="tabular-nums">−{fmt(num(sale.discountTotal))}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax</span>
          <span className="tabular-nums">{fmt(num(sale.taxTotal))}</span>
        </div>
        <div
          className={cn(
            'flex justify-between border-t border-black pt-1 font-bold',
            narrow ? 'text-[10px]' : 'text-[11px]',
          )}
        >
          <span>Total</span>
          <span className="tabular-nums">{fmt(num(sale.total))}</span>
        </div>
      </section>

      <section className={cn('mt-2 space-y-1 font-mono', narrow ? 'text-[9px]' : 'text-[10px]')}>
        <p className="font-semibold uppercase tracking-wide">Payment</p>
        {sale.payments?.length ? (
          <ul className="space-y-0.5">
            {sale.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>{p.method}</span>
                <span className="tabular-nums">{fmt(num(p.amount))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-neutral-600">No payment rows</p>
        )}
        <div className="mt-1 flex justify-between border-t border-neutral-300 pt-1 font-semibold">
          <span>Amount paid</span>
          <span className="tabular-nums">{fmt(amountPaid)}</span>
        </div>
        <div className="flex justify-between">
          <span>Change</span>
          <span className="tabular-nums">{fmt(change)}</span>
        </div>
        <p className="text-[9px] text-neutral-600">Status: {sale.paymentStatus}</p>
      </section>

      <ReceiptScanBlock value={scanPayload} narrow={narrow} />

      {branding?.receiptFooter?.trim() ? (
        <p
          className={cn(
            'mt-3 whitespace-pre-wrap border-t border-dashed border-black pt-2 text-center font-sans font-medium text-neutral-800',
            narrow ? 'text-[9px]' : 'text-[10px]',
          )}
        >
          {branding.receiptFooter.trim()}
        </p>
      ) : (
        <p
          className={cn(
            'mt-3 border-t border-dashed border-black pt-2 text-center font-sans font-medium text-neutral-800',
            narrow ? 'text-[10px]' : 'text-[11px]',
          )}
        >
          Thank you for your purchase!
        </p>
      )}
    </div>
  );
}
