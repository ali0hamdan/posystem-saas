import type { B2bPrintData } from '@/api/wholesale/b2b-print.api';
import { formatMoney } from '@/lib/format-money';

type Props = { data: B2bPrintData };

export function PrintableTotals({ data }: Props) {
  const { totals, document, payments } = data;
  const currency = document.currency;

  return (
    <div className="b2b-print-totals-wrap">
      {payments && payments.length > 0 ? (
        <div className="b2b-print-payments">
          <h3>Payments</h3>
          <ul>
            {payments.map((p) => (
              <li key={p.id}>
                {p.method} — {formatMoney(p.amount, currency)} ({new Date(p.createdAt).toLocaleDateString()})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <dl className="b2b-print-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatMoney(totals.subtotal, currency)}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd>{formatMoney(totals.discountTotal, currency)}</dd>
        </div>
        <div>
          <dt>Tax</dt>
          <dd>{formatMoney(totals.taxTotal, currency)}</dd>
        </div>
        {totals.shippingFee ? (
          <div>
            <dt>Shipping</dt>
            <dd>{formatMoney(totals.shippingFee, currency)}</dd>
          </div>
        ) : null}
        <div className="b2b-print-total-row">
          <dt>Total</dt>
          <dd>{formatMoney(totals.total, currency)}</dd>
        </div>
        {totals.amountPaid != null ? (
          <div>
            <dt>Amount paid</dt>
            <dd>{formatMoney(totals.amountPaid, currency)}</dd>
          </div>
        ) : null}
        {totals.balanceDue != null ? (
          <div className="b2b-print-balance-row">
            <dt>Balance due</dt>
            <dd>{formatMoney(totals.balanceDue, currency)}</dd>
          </div>
        ) : null}
        {document.paymentStatus ? (
          <div>
            <dt>Payment status</dt>
            <dd>{document.paymentStatus}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
