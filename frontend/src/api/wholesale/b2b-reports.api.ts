import { api } from '@/api/client';

export async function fetchB2bQuotationReport(from?: string, to?: string) {
  const { data } = await api.get('/reports/b2b-documents/quotations', { params: { from, to } });
  return data;
}

export async function fetchB2bProformaReport(from?: string, to?: string) {
  const { data } = await api.get('/reports/b2b-documents/proforma-invoices', { params: { from, to } });
  return data;
}
