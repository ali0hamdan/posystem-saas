import type { RefundPrintData } from '@/api/refunds.api';

const RESTOCK_LABELS: Record<string, string> = {
  RESTOCK: 'Return to stock',
  DAMAGED: 'Damaged',
  DISCARD: 'Discard',
  NO_RESTOCK: 'No restock',
};

type Props = { data: RefundPrintData };

export function PrintableRefundLayout({ data }: Props) {
  return (
    <div id="refund-print-document" className="refund-print-document mx-auto max-w-[210mm] bg-white p-8 text-black">
      <header className="border-b border-black/20 pb-4">
        {data.company.logoUrl ? (
          <img src={data.company.logoUrl} alt="" className="mb-3 h-12 object-contain" />
        ) : null}
        <h1 className="text-2xl font-bold uppercase tracking-wide">{data.title}</h1>
        <p className="text-sm text-gray-600">{data.subtitle}</p>
        <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          <p className="font-semibold">{data.company.businessName}</p>
          {data.company.branchName ? <p>Branch: {data.company.branchName}</p> : null}
          {data.company.address ? <p>{data.company.address}</p> : null}
          {data.company.phone ? <p>Tel: {data.company.phone}</p> : null}
          {data.company.email ? <p>{data.company.email}</p> : null}
        </div>
      </header>

      <section className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <h2 className="mb-1 font-semibold uppercase text-gray-600">Refund</h2>
          <p>
            <span className="text-gray-600">Refund #:</span> {data.refund.refundNumber}
          </p>
          <p>
            <span className="text-gray-600">Type:</span> {data.refund.refundType}
          </p>
          <p>
            <span className="text-gray-600">Status:</span> {data.refund.status}
          </p>
          <p>
            <span className="text-gray-600">Date:</span>{' '}
            {new Date(data.refund.createdAt).toLocaleString()}
          </p>
          <p>
            <span className="text-gray-600">Source:</span> {data.refund.sourceTypeLabel} —{' '}
            {data.refund.sourceNumber}
          </p>
          <p>
            <span className="text-gray-600">Reason:</span> {data.refund.reason}
          </p>
          {data.refund.notes ? (
            <p>
              <span className="text-gray-600">Notes:</span> {data.refund.notes}
            </p>
          ) : null}
          {data.refund.paymentMethod ? (
            <p>
              <span className="text-gray-600">Refund method:</span> {data.refund.paymentMethod}
            </p>
          ) : null}
        </div>

        {data.customer ? (
          <div>
            <h2 className="mb-1 font-semibold uppercase text-gray-600">Customer</h2>
            <p>{data.customer.name}</p>
            {data.customer.companyName && data.customer.companyName !== data.customer.name ? (
              <p>{data.customer.companyName}</p>
            ) : null}
            {data.customer.phone ? <p>{data.customer.phone}</p> : null}
            {data.customer.email ? <p>{data.customer.email}</p> : null}
            {data.customer.address ? <p>{data.customer.address}</p> : null}
            {data.customer.taxNumber ? <p>VAT/Tax: {data.customer.taxNumber}</p> : null}
          </div>
        ) : null}
      </section>

      <table className="refund-print-items mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black/30 text-left text-xs uppercase">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Item</th>
            <th className="py-2 pr-2">SKU</th>
            <th className="py-2 pr-2 text-right">Qty</th>
            <th className="py-2 pr-2 text-right">Unit</th>
            <th className="py-2 pr-2 text-right">Amount</th>
            <th className="py-2">Restock</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((line) => (
            <tr key={line.lineNumber} className="border-b border-black/10">
              <td className="py-2 pr-2">{line.lineNumber}</td>
              <td className="py-2 pr-2">{line.itemName}</td>
              <td className="py-2 pr-2 font-mono text-xs">{line.sku ?? '—'}</td>
              <td className="py-2 pr-2 text-right">
                {line.refundedQuantity}
                {line.originalQuantity != null ? ` / ${line.originalQuantity}` : ''}
              </td>
              <td className="py-2 pr-2 text-right">
                {data.refund.currency} {line.unitPrice}
              </td>
              <td className="py-2 pr-2 text-right">
                {data.refund.currency} {line.lineAmount}
              </td>
              <td className="py-2 text-xs">
                {RESTOCK_LABELS[line.restockAction] ?? line.restockAction}
                {line.restockQuantity > 0 ? ` (${line.restockQuantity})` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal refunded</span>
          <span>
            {data.refund.currency} {data.totals.subtotalRefunded}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Tax refunded</span>
          <span>
            {data.refund.currency} {data.totals.taxRefunded}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Discount adjusted</span>
          <span>
            {data.refund.currency} {data.totals.discountAdjusted}
          </span>
        </div>
        <div className="flex justify-between border-t border-black/30 pt-2 text-base font-bold">
          <span>Total refunded</span>
          <span>
            {data.refund.currency} {data.totals.totalRefunded}
          </span>
        </div>
      </div>

      <section className="mt-8 border-t border-black/20 pt-4 text-sm">
        <h2 className="mb-2 font-semibold uppercase text-gray-600">Authorization</h2>
        <p>
          <span className="text-gray-600">Created by:</span> {data.approval.createdBy}
        </p>
        {data.approval.approvedBy ? (
          <p>
            <span className="text-gray-600">Approved by:</span> {data.approval.approvedBy}
          </p>
        ) : null}
        {data.approval.approvalMethodLabel ? (
          <p>
            <span className="text-gray-600">Method:</span> {data.approval.approvalMethodLabel}
          </p>
        ) : null}
        {data.approval.approvalIdSnapshot ? (
          <p>
            <span className="text-gray-600">Approval ID:</span>{' '}
            <span className="font-mono">{data.approval.approvalIdSnapshot}</span>
          </p>
        ) : null}
        {data.approval.nfcUidMasked ? (
          <p>
            <span className="text-gray-600">NFC:</span> {data.approval.nfcUidMasked}
          </p>
        ) : null}
        {data.approval.approvedAt ? (
          <p>
            <span className="text-gray-600">Approved at:</span>{' '}
            {new Date(data.approval.approvedAt).toLocaleString()}
          </p>
        ) : null}
      </section>

      {data.footerText ? (
        <footer className="mt-8 border-t border-black/10 pt-4 text-center text-xs text-gray-600">
          {data.footerText}
        </footer>
      ) : null}
    </div>
  );
}
