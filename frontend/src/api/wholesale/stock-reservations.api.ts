import { api } from '@/api/client';

export type StockReservationStatus = 'ACTIVE' | 'RELEASED' | 'CONVERTED' | 'EXPIRED';

export type StockReservation = {
  id: string;
  clientId: string;
  branchId: string;
  productId: string;
  customerId: string | null;
  sourceType: 'QUOTATION' | 'PROFORMA';
  sourceId: string;
  quantity: number;
  status: StockReservationStatus;
  expiresAt: string | null;
  createdAt: string;
};

export async function listStockReservations(params?: {
  status?: StockReservationStatus;
  page?: number;
  limit?: number;
}) {
  const { data } = await api.get<{ data: StockReservation[]; meta: { total: number } }>(
    '/wholesale/stock-reservations',
    { params },
  );
  return data;
}

export async function releaseStockReservation(id: string) {
  const { data } = await api.post<StockReservation>(`/wholesale/stock-reservations/${id}/release`);
  return data;
}
