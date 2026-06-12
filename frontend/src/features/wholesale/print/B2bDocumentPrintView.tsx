import type { B2bPrintData } from '@/api/wholesale/b2b-print.api';
import { PrintableDocumentLayout } from './PrintableDocumentLayout';
import { PrintableHeader } from './PrintableHeader';
import { PrintableCustomerInfo } from './PrintableCustomerInfo';
import { PrintableItemsTable } from './PrintableItemsTable';
import { PrintableTotals } from './PrintableTotals';
import { PrintableTerms } from './PrintableTerms';
import { PrintableSignatureArea } from './PrintableSignatureArea';

type Props = { data: B2bPrintData };

export function B2bDocumentPrintView({ data }: Props) {
  return (
    <PrintableDocumentLayout>
      <PrintableHeader data={data} />
      <PrintableCustomerInfo data={data} />
      <PrintableItemsTable data={data} />
      <PrintableTotals data={data} />
      <PrintableTerms data={data} />
      <PrintableSignatureArea show={data.terms.showSignatureArea} />
    </PrintableDocumentLayout>
  );
}
