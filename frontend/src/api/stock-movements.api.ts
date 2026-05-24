import { api } from '@/api/client';
import type { Product } from '@/types/product';
import type { StockMovement, ManualAdjustMovementType, StockMovementsListResponse, StockMovementType } from '@/types/stock-movement';

export type ListStockMovementsParams = {
  page?: number;
  limit?: number;
  productId?: string;
  type?: StockMovementType;
  fromDate?: string;
  toDate?: string;
};

export async function fetchStockMovements(
  params: ListStockMovementsParams,
): Promise<StockMovementsListResponse> {
  const { data } = await api.get<StockMovementsListResponse>('/stock-movements', { params });
  return data;
}

export type AdjustStockBody = {
  productId: string;
  quantityChange: number;
  type: ManualAdjustMovementType;
  reason: string;
  referenceType?: string;
  referenceId?: string;
  allowNegativeStock?: boolean;
};

export type AdjustStockResponse = {
  product: Product;
  movement: StockMovement;
};

export async function adjustStock(body: AdjustStockBody): Promise<AdjustStockResponse> {
  const { data } = await api.post<AdjustStockResponse>('/stock-movements/adjust', body);
  return data;
}
