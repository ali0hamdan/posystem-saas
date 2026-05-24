import type { PaginationMeta } from '@/types/paginated';

export type StockMovementType = 'SALE' | 'RETURN' | 'PURCHASE' | 'ADJUSTMENT' | 'DAMAGE' | 'EXPIRED';

export type StockMovementProduct = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  quantity: number;
  minStock: number;
};

export type StockMovementUser = {
  id: string;
  username: string;
  name: string;
  role: string;
};

export type StockMovement = {
  id: string;
  productId: string;
  type: StockMovementType;
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdById: string;
  createdAt: string;
  product: StockMovementProduct;
  createdBy: StockMovementUser;
};

export type StockMovementsListResponse = {
  data: StockMovement[];
  meta: PaginationMeta;
};

export type ManualAdjustMovementType = 'ADJUSTMENT' | 'DAMAGE' | 'EXPIRED';
