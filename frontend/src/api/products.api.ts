import { api } from '@/api/client';
import type { PaginatedResponse } from '@/types/paginated';
import type { Product } from '@/types/product';

export type ListProductsParams = {
  page?: number;
  limit?: number;
  q?: string;
  categoryId?: string;
  includeInactive?: boolean;
};

export async function fetchProducts(params: ListProductsParams): Promise<PaginatedResponse<Product>> {
  const { data } = await api.get<PaginatedResponse<Product>>('/products', { params });
  return data;
}

export async function fetchProductByBarcode(barcode: string): Promise<Product> {
  const encoded = encodeURIComponent(barcode.trim());
  const { data } = await api.get<Product>(`/products/barcode/${encoded}`);
  return data;
}

export async function fetchProduct(id: string): Promise<Product> {
  const { data } = await api.get<Product>(`/products/${id}`);
  return data;
}

export async function fetchLowStockProducts(params: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Product>> {
  const { data } = await api.get<PaginatedResponse<Product>>('/products/low-stock', { params });
  return data;
}

export type CreateProductBody = {
  name: string;
  categoryId: string;
  barcode?: string;
  sku?: string;
  supplierId?: string;
  costPrice: number;
  sellingPrice: number;
  quantity?: number;
  minStock?: number;
  unitType?: string;
  imageUrl?: string;
  isActive?: boolean;
};

export type UpdateProductBody = Partial<
  Omit<CreateProductBody, 'quantity'> & {
    isActive?: boolean;
  }
>;

export async function createProduct(body: CreateProductBody): Promise<Product> {
  const { data } = await api.post<Product>('/products', body);
  return data;
}

export async function updateProduct(id: string, body: UpdateProductBody): Promise<Product> {
  const { data } = await api.patch<Product>(`/products/${id}`, body);
  return data;
}

export async function deactivateProduct(id: string): Promise<Product> {
  const { data } = await api.delete<Product>(`/products/${id}`);
  return data;
}

export async function generateSku(params: {
  categoryId: string;
  productName: string;
  excludeId?: string;
}): Promise<{ sku: string }> {
  const q = new URLSearchParams({ categoryId: params.categoryId, productName: params.productName });
  if (params.excludeId) q.set('excludeId', params.excludeId);
  const { data } = await api.get<{ sku: string }>(`/products/generate-sku?${q}`);
  return data;
}

export async function generateBarcode(): Promise<{ barcode: string }> {
  const { data } = await api.post<{ barcode: string }>('/products/generate-barcode');
  return data;
}

export async function checkBarcode(params: {
  barcode: string;
  excludeId?: string;
}): Promise<{ available: boolean; conflictProductName?: string }> {
  const q = new URLSearchParams({ barcode: params.barcode });
  if (params.excludeId) q.set('excludeId', params.excludeId);
  const { data } = await api.get<{ available: boolean; conflictProductName?: string }>(`/products/check-barcode?${q}`);
  return data;
}
