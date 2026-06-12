import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  footerNote?: string;
};

export function PrintableDocumentLayout({ children, footerNote }: Props) {
  return (
    <article id="b2b-print-document" className="b2b-print-document" dir="auto">
      {children}
      <footer className="b2b-print-page-footer">
        {footerNote ? <p>{footerNote}</p> : null}
        <p className="b2b-print-thanks">Thank you for your business.</p>
      </footer>
    </article>
  );
}
