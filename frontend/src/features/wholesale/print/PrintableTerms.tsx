import type { B2bPrintData } from '@/api/wholesale/b2b-print.api';

type Props = { data: B2bPrintData };

export function PrintableTerms({ data }: Props) {
  const { terms, document } = data;
  const termsText = terms.terms ?? terms.defaultTerms;
  const hasContent =
    termsText || terms.notes || document.sourceReference || document.convertedStatus || terms.footerText;

  if (!hasContent) return null;

  return (
    <section className="b2b-print-terms">
      {document.sourceReference ? <p className="b2b-print-ref">{document.sourceReference}</p> : null}
      {document.convertedStatus ? <p className="b2b-print-ref">{document.convertedStatus}</p> : null}
      {termsText ? (
        <div>
          <h3>Terms &amp; conditions</h3>
          <p className="b2b-print-terms-body">{termsText}</p>
        </div>
      ) : null}
      {terms.notes ? (
        <div>
          <h3>Notes</h3>
          <p className="b2b-print-terms-body">{terms.notes}</p>
        </div>
      ) : null}
      {terms.footerText ? <p className="b2b-print-footer-text">{terms.footerText}</p> : null}
    </section>
  );
}
