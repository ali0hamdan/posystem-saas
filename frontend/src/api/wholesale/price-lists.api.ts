import { api } from '@/api/client';

export type PriceListItem = {
  id: string;
  productId: string;
  minQuantity: number;
  unitPrice: string;
};

export type PriceList = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  items?: PriceListItem[];
  _count?: { items: number; customers: number };
};

export async function listPriceLists() {
  const { data } = await api.get<PriceList[]>('/wholesale/price-lists');
  return data;
}

export async function getPriceList(id: string) {
  const { data } = await api.get<PriceList>(`/wholesale/price-lists/${id}`);
  return data;
}

export async function createPriceList(body: {
  name: string;
  description?: string;
  items?: { productId: string; minQuantity: number; unitPrice: number }[];
}) {
  const { data } = await api.post<PriceList>('/wholesale/price-lists', body);
  return data;
}

export async function upsertPriceListItems(
  id: string,
  items: { productId: string; minQuantity: number; unitPrice: number }[],
) {
  const { data } = await api.put<PriceList>(`/wholesale/price-lists/${id}/items`, { items });
  return data;
}

export async function assignCustomerPriceList(customerId: string, priceListId: string) {
  const { data } = await api.post('/wholesale/price-lists/assign-customer', { customerId, priceListId });
  return data;
}

export async function resolveWholesalePrice(productId: string, quantity: number, customerId?: string) {
  const { data } = await api.get<{ unitPrice: string }>('/wholesale/price-lists/resolve-price', {
    params: { productId, quantity, customerId },
  });
  return data;
}
