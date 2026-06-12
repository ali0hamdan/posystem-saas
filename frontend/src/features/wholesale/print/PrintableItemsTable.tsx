import type { B2bPrintData } from '@/api/wholesale/b2b-print.api';
import { formatMoney } from '@/lib/format-money';

type Props = { data: B2bPrintData };

export function PrintableItemsTable({ data }: Props) {
  const currency = data.document.currency;
  return (
    <table className="b2b-print-items">
      <thead>
        <tr>
          <th>#</th>
          <th>Item</th>
          <th>SKU</th>
          <th className="num">Qty</th>
          <th className="num">Unit price</th>
          <th className="num">Discount</th>
          <th className="num">Tax</th>
          <th className="num">Total</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((line) => (
          <tr key={line.lineNumber}>
            <td>{line.lineNumber}</td>
            <td>
              {line.productName}
              {line.notes ? <div className="b2b-print-line-note">{line.notes}</div> : null}
            </td>
            <td>{line.sku ?? '—'}</td>
            <td className="num">{line.quantity}</td>
            <td className="num">{formatMoney(line.unitPrice, currency)}</td>
            <td className="num">{formatMoney(line.discount, currency)}</td>
            <td className="num">{line.taxRate ? `${line.taxRate}%` : '—'}</td>
            <td className="num">{formatMoney(line.lineTotal, currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
