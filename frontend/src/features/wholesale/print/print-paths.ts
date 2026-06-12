export type B2bPrintDocKind = 'quotation' | 'proforma' | 'invoice';

export function b2bPrintPath(kind: B2bPrintDocKind, id: string, wholesale = true): string {
  const base = wholesale ? '/wholesale' : '';
  if (kind === 'quotation') return `${base}/quotations/${id}/print`;
  if (kind === 'proforma') return `${base}/proforma-invoices/${id}/print`;
  return wholesale ? `${base}/invoices/${id}/print` : `/sales/${id}/print`;
}

export function isWholesalePath(pathname: string): boolean {
  return pathname.includes('/wholesale/');
}
