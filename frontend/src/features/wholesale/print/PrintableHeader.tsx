import type { B2bPrintData } from '@/api/wholesale/b2b-print.api';

type Props = { data: B2bPrintData };

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export function PrintableHeader({ data }: Props) {
  const { company, document, title, subtitle } = data;
  return (
    <header className="b2b-print-header">
      <div className="b2b-print-header-left">
        {company.logoUrl ? (
          <img src={company.logoUrl} alt="" className="b2b-print-logo" />
        ) : null}
        <div>
          <p className="b2b-print-company-name">{company.businessName || company.storeName}</p>
          {company.branchName ? <p className="b2b-print-meta">{company.branchName}</p> : null}
          {company.address ? <p className="b2b-print-meta">{company.address}</p> : null}
          {company.phone ? <p className="b2b-print-meta">Tel: {company.phone}</p> : null}
          {company.email ? <p className="b2b-print-meta">{company.email}</p> : null}
          {company.taxNumber ? <p className="b2b-print-meta">Tax/VAT: {company.taxNumber}</p> : null}
        </div>
      </div>
      <div className="b2b-print-header-right">
        <h1 className="b2b-print-title">{title}</h1>
        <p className="b2b-print-subtitle">{subtitle}</p>
        <p className="b2b-print-doc-number">{document.number}</p>
        <dl className="b2b-print-doc-meta">
          <div>
            <dt>Issue date</dt>
            <dd>{formatDate(document.issueDate)}</dd>
          </div>
          {document.validUntil ? (
            <div>
              <dt>Valid until</dt>
              <dd>{formatDate(document.validUntil)}</dd>
            </div>
          ) : null}
          {document.dueDate ? (
            <div>
              <dt>Due date</dt>
              <dd>{formatDate(document.dueDate)}</dd>
            </div>
          ) : null}
          <div>
            <dt>Status</dt>
            <dd>{document.status.replace(/_/g, ' ')}</dd>
          </div>
          {document.createdBy ? (
            <div>
              <dt>Prepared by</dt>
              <dd>{document.createdBy}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </header>
  );
}
