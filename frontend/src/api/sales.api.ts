import { api } from '@/api/client';
import type { CreateSaleBody, CreatedSale } from '@/types/sales';
import type {
  CreateRefundBody,
  ListSalesParams,
  PaginatedSalesResponse,
  SaleDetail,
  SaleFilterUser,
} from '@/types/sales-history';

export async function createSale(body: CreateSaleBody): Promise<CreatedSale> {
  const { data } = await api.post<CreatedSale>('/sales', body, { timeout: 6_000 });
  return data;
}

export async function fetchSales(params: ListSalesParams): Promise<PaginatedSalesResponse> {
  const { data } = await api.get<PaginatedSalesResponse>('/sales', { params });
  return data;
}

export async function fetchSale(id: string): Promise<SaleDetail> {
  const { data } = await api.get<SaleDetail>(`/sales/${id}`);
  return data;
}

export async function fetchSaleFilterUsers(): Promise<SaleFilterUser[]> {
  const { data } = await api.get<SaleFilterUser[]>('/sales/filters/users');
  return data;
}

export async function refundSale(saleId: string, body: CreateRefundBody): Promise<unknown> {
  const { data } = await api.post(`/sales/${saleId}/refund`, body);
  return data;
}
