import { api } from '@/api/client';

export type StockTransferStatus = 'DRAFT' | 'SENT' | 'RECEIVED' | 'CANCELLED';

export type StockTransferLine = {
  id: string;
  productId: string;
  quantity: number;
  product: { id: string; name: string; sku: string | null };
};

export type StockTransferRow = {
  id: string;
  fromBranchId: string;
  toBranchId: string;
  status: StockTransferStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  receivedAt: string | null;
  items: StockTransferLine[];
  fromBranch: { id: string; name: string; code: string };
  toBranch: { id: string; name: string; code: string };
  createdBy: { id: string; name: string; username: string; role: string };
};

export type StockTransferListResponse = {
  data: StockTransferRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export async function fetchStockTransfers(params?: {
  page?: number;
  limit?: number;
  status?: StockTransferStatus;
}): Promise<StockTransferListResponse> {
  const { data } = await api.get<StockTransferListResponse>('/stock-transfers', { params });
  return data;
}

export type CreateStockTransferBody = {
  fromBranchId: string;
  toBranchId: string;
  note?: string;
  items: { productId: string; quantity: number }[];
};

export async function createStockTransfer(body: CreateStockTransferBody): Promise<StockTransferRow> {
  const { data } = await api.post<StockTransferRow>('/stock-transfers', body);
  return data;
}

export async function updateStockTransferStatus(
  id: string,
  status: StockTransferStatus,
): Promise<StockTransferRow> {
  const { data } = await api.patch<StockTransferRow>(`/stock-transfers/${id}/status`, { status });
  return data;
}
