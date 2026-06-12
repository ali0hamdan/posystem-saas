import { api } from '@/api/client';

export type PriceListRow = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  productCount?: number;
  _count?: { items: number; customers: number };
};

export type PriceTier = {
  id: string;
  productId: string;
  minQuantity: number;
  maxQuantity: number | null;
  unitPrice: string;
  notes: string | null;
};

export type PriceListProductGroup = {
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    sellingPrice: string;
  } | null;
  tiers: PriceTier[];
  tierCount: number;
  lowestWholesalePrice: string | null;
  normalSellingPrice: string | null;
};

export type PricePreviewResult = {
  applied: boolean;
  productId: string;
  quantity: number;
  normalUnitPrice: string;
  finalUnitPrice: string;
  appliedPriceListId: string | null;
  appliedPriceListName: string | null;
  appliedTier: {
    id: string;
    minQuantity: number;
    maxQuantity: number | null;
    unitPrice: string;
  } | null;
  normalTotal: string;
  finalTotal: string;
  savings: string;
  discountPerUnit: string;
};

export type BulkPricingDashboard = {
  totalPriceLists: number;
  activePriceLists: number;
  productsWithBulkPricing: number;
  customersAssigned: number;
  averageDiscountPercent: number;
};

export async function fetchBulkPricingDashboard() {
  const { data } = await api.get<BulkPricingDashboard>('/wholesale/bulk-pricing/dashboard');
  return data;
}

export async function listBulkPriceLists(params?: {
  q?: string;
  status?: 'all' | 'active' | 'inactive';
  hasCustomers?: boolean;
  hasProducts?: boolean;
}) {
  const { data } = await api.get<PriceListRow[]>('/wholesale/bulk-pricing/price-lists', { params });
  return data;
}

export async function getBulkPriceList(id: string) {
  const { data } = await api.get(`/wholesale/bulk-pricing/price-lists/${id}`);
  return data;
}

export async function createBulkPriceList(body: {
  name: string;
  description?: string;
  isActive?: boolean;
}) {
  const { data } = await api.post<PriceListRow>('/wholesale/bulk-pricing/price-lists', body);
  return data;
}

export async function updateBulkPriceList(
  id: string,
  body: { name?: string; description?: string | null; isActive?: boolean },
) {
  const { data } = await api.patch(`/wholesale/bulk-pricing/price-lists/${id}`, body);
  return data;
}

export async function setBulkPriceListStatus(id: string, isActive: boolean) {
  const { data } = await api.patch(`/wholesale/bulk-pricing/price-lists/${id}/status`, { isActive });
  return data;
}

export async function deleteBulkPriceList(id: string) {
  const { data } = await api.delete(`/wholesale/bulk-pricing/price-lists/${id}`);
  return data;
}

export async function duplicateBulkPriceList(id: string) {
  const { data } = await api.post<PriceListRow>(`/wholesale/bulk-pricing/price-lists/${id}/duplicate`);
  return data;
}

export async function listBulkPriceListProducts(id: string) {
  const { data } = await api.get<PriceListProductGroup[]>(`/wholesale/bulk-pricing/price-lists/${id}/products`);
  return data;
}

export async function addBulkPriceListProduct(
  id: string,
  body: {
    productId: string;
    tiers: { minQuantity: number; maxQuantity?: number | null; unitPrice: number; notes?: string }[];
  },
) {
  const { data } = await api.post(`/wholesale/bulk-pricing/price-lists/${id}/products`, body);
  return data;
}

export async function upsertBulkProductTiers(
  id: string,
  productId: string,
  tiers: { minQuantity: number; maxQuantity?: number | null; unitPrice: number; notes?: string }[],
) {
  const { data } = await api.put(`/wholesale/bulk-pricing/price-lists/${id}/products/${productId}/tiers`, { tiers });
  return data;
}

export async function removeBulkPriceListProduct(id: string, productId: string) {
  const { data } = await api.delete(`/wholesale/bulk-pricing/price-lists/${id}/products/${productId}`);
  return data;
}

export async function listBulkPriceListCustomers(id: string) {
  const { data } = await api.get(`/wholesale/bulk-pricing/price-lists/${id}/customers`);
  return data;
}

export async function assignBulkPriceListCustomer(id: string, customerId: string, replaceExisting = false) {
  const { data } = await api.post(`/wholesale/bulk-pricing/price-lists/${id}/customers`, {
    customerId,
    replaceExisting,
  });
  return data;
}

export async function unassignBulkPriceListCustomer(id: string, customerId: string) {
  const { data } = await api.delete(`/wholesale/bulk-pricing/price-lists/${id}/customers/${customerId}`);
  return data;
}

export async function previewBulkPrice(body: {
  customerId?: string;
  productId: string;
  quantity: number;
}) {
  const { data } = await api.post<PricePreviewResult>('/wholesale/bulk-pricing/preview', body);
  return data;
}
