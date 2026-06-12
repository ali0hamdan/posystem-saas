import { api } from '@/api/client';

export type ProformaInvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'APPROVED'
  | 'CANCELLED'
  | 'CONVERTED_TO_INVOICE';

export type ProformaInvoiceItem = {
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

export type ProformaInvoice = {
  id: string;
  clientId: string;
  branchId: string;
  customerId: string | null;
  quotationId: string | null;
  proformaNumber: string;
  status: ProformaInvoiceStatus;
  validUntil: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  notes: string | null;
  terms: string | null;
  reserveStock: boolean;
  convertedToInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
  items: ProformaInvoiceItem[];
};

export type ProformaItemInput = {
  productId: string;
  quantity: number;
  unitPrice?: number;
  discount?: number;
  taxRate?: number;
  notes?: string;
};

export type CreateProformaBody = {
  customerId?: string;
  quotationId?: string;
  validUntil?: string;
  items: ProformaItemInput[];
  notes?: string;
  terms?: string;
  reserveStock?: boolean;
};

export type UpdateProformaBody = Partial<CreateProformaBody> & {
  customerId?: string | null;
  validUntil?: string | null;
  notes?: string | null;
  terms?: string | null;
};

export type ListProformaParams = {
  status?: ProformaInvoiceStatus;
  customerId?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type PaginatedProformaResponse = {
  data: ProformaInvoice[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type ConvertProformaToInvoiceBody = {
  payments?: { method: 'CASH' | 'CARD' | 'MIXED' | 'CREDIT'; amount: number }[];
  couponCode?: string;
};

export async function listProformaInvoices(params: ListProformaParams = {}): Promise<PaginatedProformaResponse> {
  const { data } = await api.get<PaginatedProformaResponse>('/proforma-invoices', { params });
  return data;
}

export async function getProformaInvoice(id: string): Promise<ProformaInvoice> {
  const { data } = await api.get<ProformaInvoice>(`/proforma-invoices/${id}`);
  return data;
}

export async function createProformaInvoice(body: CreateProformaBody): Promise<ProformaInvoice> {
  const { data } = await api.post<ProformaInvoice>('/proforma-invoices', body);
  return data;
}

export async function updateProformaInvoice(id: string, body: UpdateProformaBody): Promise<ProformaInvoice> {
  const { data } = await api.patch<ProformaInvoice>(`/proforma-invoices/${id}`, body);
  return data;
}

export async function setProformaStatus(id: string, status: ProformaInvoiceStatus): Promise<ProformaInvoice> {
  const { data } = await api.patch<ProformaInvoice>(`/proforma-invoices/${id}/status`, { status });
  return data;
}

export async function approveProforma(id: string): Promise<ProformaInvoice> {
  const { data } = await api.post<ProformaInvoice>(`/proforma-invoices/${id}/approve`);
  return data;
}

export async function cancelProforma(id: string): Promise<ProformaInvoice> {
  const { data } = await api.post<ProformaInvoice>(`/proforma-invoices/${id}/cancel`);
  return data;
}

export async function reserveProformaStock(id: string): Promise<{ reservations: unknown[] }> {
  const { data } = await api.post(`/proforma-invoices/${id}/reserve-stock`);
  return data;
}

export async function releaseProformaReservation(id: string): Promise<{ released: number }> {
  const { data } = await api.post(`/proforma-invoices/${id}/release-reservation`);
  return data;
}

export async function convertProformaToInvoice(
  id: string,
  body: ConvertProformaToInvoiceBody = {},
): Promise<{ proformaId: string; sale: { id: string; invoiceNumber: string } }> {
  const { data } = await api.post(`/proforma-invoices/${id}/convert-to-invoice`, body);
  return data;
}
