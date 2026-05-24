import { api } from '@/api/client';
import type { PaginatedResponse } from '@/types/paginated';
import type { ProductLabelFields } from '@/features/product-labels/label-utils';

export type PurchaseStatus = 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';

export type PurchaseOrderSupplier = {
  id: string;
  name: string;
  isActive: boolean;
};

export type PurchaseOrderSummary = {
  id: string;
  branchId: string;
  supplierId: string;
  status: PurchaseStatus;
  total: string | number;
  paidAmount: string | number;
  createdAt: string;
  updatedAt: string;
  supplier: PurchaseOrderSupplier;
  _count: { items: number };
};

export type PurchaseOrderLineProduct = ProductLabelFields & {
  costPrice?: string | number;
  unitType?: string;
};

export type PurchaseOrderLine = {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  costPrice: string | number;
  total: string | number;
  product: PurchaseOrderLineProduct;
};

export type PurchaseOrderDetail = PurchaseOrderSummary & {
  items: PurchaseOrderLine[];
};

export type ListPurchaseOrdersParams = {
  page?: number;
  limit?: number;
  status?: PurchaseStatus;
  supplierId?: string;
};

export async function fetchPurchaseOrders(
  params: ListPurchaseOrdersParams,
): Promise<PaginatedResponse<PurchaseOrderSummary>> {
  const { data } = await api.get<PaginatedResponse<PurchaseOrderSummary>>('/purchase-orders', { params });
  return data;
}

export async function fetchPurchaseOrder(id: string): Promise<PurchaseOrderDetail> {
  const { data } = await api.get<PurchaseOrderDetail>(`/purchase-orders/${id}`);
  return data;
}

export async function receivePurchaseOrder(
  id: string,
  body?: { updateProductCostPrices?: boolean },
): Promise<PurchaseOrderDetail> {
  const { data } = await api.post<PurchaseOrderDetail>(`/purchase-orders/${id}/receive`, body ?? {});
  return data;
}

export type POLineInput = {
  productId: string;
  quantity: number;
  costPrice: number;
};

export type CreatePurchaseOrderBody = {
  supplierId: string;
  items: POLineInput[];
  status?: 'DRAFT' | 'ORDERED';
  paidAmount?: number;
};

export type UpdatePurchaseOrderBody = {
  supplierId?: string;
  items?: POLineInput[];
  status?: 'DRAFT' | 'ORDERED' | 'CANCELLED';
  paidAmount?: number;
};

export async function createPurchaseOrder(body: CreatePurchaseOrderBody): Promise<PurchaseOrderDetail> {
  const { data } = await api.post<PurchaseOrderDetail>('/purchase-orders', body);
  return data;
}

export async function updatePurchaseOrder(
  id: string,
  body: UpdatePurchaseOrderBody,
): Promise<PurchaseOrderDetail> {
  const { data } = await api.patch<PurchaseOrderDetail>(`/purchase-orders/${id}`, body);
  return data;
}
