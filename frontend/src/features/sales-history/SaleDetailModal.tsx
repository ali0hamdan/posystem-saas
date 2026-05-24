import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/api/client';
import { fetchSale } from '@/api/sales.api';
import { formatMoney } from '@/lib/format-money';
import { refundedQtyBySaleItem } from '@/lib/sale-refund-helpers';
import type { SaleDetail } from '@/types/sales-history';

function num(v: string | number): number {
  return typeof v === 'number' ? v : Number(v);
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function paymentStatusLabel(s: string): string {
  switch (s) {
    case 'PAID':
      return 'Paid';
    case 'PARTIAL':
      return 'Partial';
    case 'UNPAID':
      return 'Unpaid';
    default:
      return s;
  }
}

function saleStatusLabel(s: string): string {
  switch (s) {
    case 'COMPLETED':
      return 'Completed';
    case 'REFUNDED':
      return 'Refunded';
    case 'PARTIALLY_REFUNDED':
      return 'Partially refunded';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return s;
  }
}

function payBadgeVariant(value: string): 'success' | 'warning' | 'muted' {
  if (value === 'PAID') return 'success';
  if (value === 'PARTIAL') return 'warning';
  return 'muted';
}

function saleBadgeVariant(value: string): 'primary' | 'danger' | 'warning' | 'muted' {
  if (value === 'COMPLETED') return 'primary';
  if (value === 'REFUNDED') return 'danger';
  if (value === 'PARTIALLY_REFUNDED') return 'warning';
  return 'muted';
}

type SaleDetailModalProps = {
  saleId: string | null;
  open: boolean;
  onClose: () => void;
  canRefund: boolean;
  onRequestRefund: (sale: SaleDetail) => void;
};

export function SaleDetailModal({ saleId, open, onClose, canRefund, onRequestRefund }: SaleDetailModalProps) {
  const detailQuery = useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => fetchSale(saleId as string),
    enabled: open && Boolean(saleId),
  });

  const sale = detailQuery.data;
  const refundedByLine = sale ? refundedQtyBySaleItem(sale) : new Map<string, number>();

  const showRefund =
    canRefund &&
    sale &&
    sale.status !== 'REFUNDED' &&
    sale.status !== 'CANCELLED' &&
    sale.items.some((it) => it.quantity > (refundedByLine.get(it.id) ?? 0));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sale details"
      description={sale ? `Invoice ${sale.invoiceNumber}` : undefined}
      size="xl"
      footer={
        showRefund && sale ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="danger"
              onClick={() => onRequestRefund(sale)}
            >
              Refund
            </Button>
          </div>
        ) : undefined
      }
    >
      {detailQuery.isLoading ? (
        <div className="py-12 text-center text-sm text-ink-muted">Loading…</div>
      ) : detailQuery.isError ? (
        <div className="py-8 text-center text-sm text-danger-600">
          {getApiErrorMessage(detailQuery.error, 'Could not load sale.')}
        </div>
      ) : sale ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Date</p>
              <p className="mt-0.5 text-sm text-ink">{formatDateTime(sale.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Cashier</p>
              <p className="mt-0.5 text-sm text-ink">{sale.cashier.name || sale.cashier.username}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Customer</p>
              <p className="mt-0.5 text-sm text-ink">{sale.customer?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Payment status</p>
              <p className="mt-1">
                <Badge variant={payBadgeVariant(sale.paymentStatus)}>
                  {paymentStatusLabel(sale.paymentStatus)}
                </Badge>
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Sale status</p>
              <p className="mt-1">
                <Badge variant={saleBadgeVariant(sale.status)}>
                  {saleStatusLabel(sale.status)}
                </Badge>
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Total</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{formatMoney(sale.total)}</p>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-canvas p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Summary</p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-ink-muted">Subtotal</dt>
                <dd className="tabular-nums text-ink">{formatMoney(sale.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-ink-muted">Discounts</dt>
                <dd className="tabular-nums text-ink">−{formatMoney(sale.discountTotal)}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-ink-muted">Tax</dt>
                <dd className="tabular-nums text-ink">{formatMoney(sale.taxTotal)}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Line items</h3>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-canvas text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Refunded</th>
                    <th className="px-3 py-2 text-right">Unit</th>
                    <th className="px-3 py-2 text-right">Discount</th>
                    <th className="px-3 py-2 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((it) => {
                    const ref = refundedByLine.get(it.id) ?? 0;
                    return (
                      <tr key={it.id} className="border-b border-line">
                        <td className="px-3 py-2 text-ink">{it.product.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink">{it.quantity}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{ref}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{formatMoney(it.unitPrice)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{formatMoney(it.discount)}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums text-ink">{formatMoney(it.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">Payments</h3>
            {sale.payments.length === 0 ? (
              <p className="text-sm text-ink-muted">No payments recorded.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[400px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-canvas text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.payments.map((p) => (
                      <tr key={p.id} className="border-b border-line">
                        <td className="px-3 py-2 capitalize text-ink">{p.method.toLowerCase()}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums text-ink">{formatMoney(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-canvas">
                      <td className="px-3 py-2 text-xs font-semibold uppercase text-ink-faint">Paid</td>
                      <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-primary-600">
                        {formatMoney(sale.payments.reduce((s, p) => s + num(p.amount), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {sale.refunds && sale.refunds.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Refunds</h3>
              <ul className="space-y-3">
                {sale.refunds.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-line bg-canvas px-3 py-3 text-sm text-ink-muted"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-ink">{formatDateTime(r.createdAt)}</span>
                      <span className="tabular-nums text-warning-700">−{formatMoney(r.totalRefunded)}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-faint">
                      By {r.user.name || r.user.username} · {r.items.length} line(s)
                    </p>
                    <p className="mt-2 text-ink-muted">{r.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">No sale selected.</p>
      )}
    </Modal>
  );
}
