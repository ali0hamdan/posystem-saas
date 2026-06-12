import { api } from '@/api/client';

export type QuotationStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CONVERTED_TO_PROFORMA'
  | 'CONVERTED_TO_INVOICE'
  | 'CANCELLED';

export type QuotationItem = {
  id: string;
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string | null;
  barcodeSnapshot: string | null;
  quantity: number;
  unitPrice: string;
  discount: string;
  taxRate: string | null;
  total: string;
  notes: string | null;
};

export type Quotation = {
  id: string;
  clientId: string;
  branchId: string;
  customerId: string | null;
  quotationNumber: string;
  status: QuotationStatus;
  validUntil: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  notes: string | null;
  terms: string | null;
  createdById: string;
  convertedToProformaId: string | null;
  convertedToInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
  items: QuotationItem[];
};

export type QuotationItemInput = {
  productId: string;
  quantity: number;
  unitPrice?: number;
  discount?: number;
  taxRate?: number;
  notes?: string;
};

export type CreateQuotationBody = {
  customerId?: string;
  validUntil?: string;
  items: QuotationItemInput[];
  notes?: string;
  terms?: string;
};

export type UpdateQuotationBody = Partial<CreateQuotationBody> & {
  customerId?: string | null;
  validUntil?: string | null;
  notes?: string | null;
  terms?: string | null;
};

export type ListQuotationsParams = {
  status?: QuotationStatus;
  customerId?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type PaginatedQuotationsResponse = {
  data: Quotation[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type ConvertQuotationToInvoiceBody = {
  payments?: { method: 'CASH' | 'CARD' | 'MIXED' | 'CREDIT'; amount: number }[];
  couponCode?: string;
};

export async function listQuotations(params: ListQuotationsParams = {}): Promise<PaginatedQuotationsResponse> {
  const { data } = await api.get<PaginatedQuotationsResponse>('/quotations', { params });
  return data;
}

export async function getQuotation(id: string): Promise<Quotation> {
  const { data } = await api.get<Quotation>(`/quotations/${id}`);
  return data;
}

export async function createQuotation(body: CreateQuotationBody): Promise<Quotation> {
  const { data } = await api.post<Quotation>('/quotations', body);
  return data;
}

export async function updateQuotation(id: string, body: UpdateQuotationBody): Promise<Quotation> {
  const { data } = await api.patch<Quotation>(`/quotations/${id}`, body);
  return data;
}

export async function setQuotationStatus(id: string, status: QuotationStatus): Promise<Quotation> {
  const { data } = await api.patch<Quotation>(`/quotations/${id}/status`, { status });
  return data;
}

export async function acceptQuotation(id: string): Promise<Quotation> {
  const { data } = await api.post<Quotation>(`/quotations/${id}/accept`);
  return data;
}

export async function rejectQuotation(id: string): Promise<Quotation> {
  const { data } = await api.post<Quotation>(`/quotations/${id}/reject`);
  return data;
}

export async function convertQuotationToProforma(id: string): Promise<{ id: string; proformaNumber: string }> {
  const { data } = await api.post(`/quotations/${id}/convert-to-proforma`);
  return data;
}

export async function convertQuotationToInvoice(
  id: string,
  body: ConvertQuotationToInvoiceBody = {},
): Promise<{ quotationId: string; sale: { id: string; invoiceNumber: string } }> {
  const { data } = await api.post(`/quotations/${id}/convert-to-invoice`, body);
  return data;
}

export async function cancelQuotation(id: string): Promise<Quotation> {
  const { data } = await api.delete<Quotation>(`/quotations/${id}`);
  return data;
}
