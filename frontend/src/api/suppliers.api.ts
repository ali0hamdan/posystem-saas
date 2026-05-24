import { api } from '@/api/client';
import type { PaginatedResponse } from '@/types/paginated';
import type { Supplier } from '@/types/supplier';

export type ListSuppliersParams = {
  page?: number;
  limit?: number;
  q?: string;
  includeInactive?: boolean;
};

export type CreateSupplierBody = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive?: boolean;
};

export type UpdateSupplierBody = Partial<CreateSupplierBody>;

export async function fetchSuppliers(
  params?: ListSuppliersParams,
): Promise<PaginatedResponse<Supplier>> {
  const { data } = await api.get<PaginatedResponse<Supplier>>('/suppliers', {
    params: { limit: 100, page: 1, ...params },
  });
  return data;
}

export async function createSupplier(body: CreateSupplierBody): Promise<Supplier> {
  const { data } = await api.post<Supplier>('/suppliers', body);
  return data;
}

export async function updateSupplier(id: string, body: UpdateSupplierBody): Promise<Supplier> {
  const { data } = await api.patch<Supplier>(`/suppliers/${id}`, body);
  return data;
}

export async function deleteSupplier(id: string): Promise<Supplier> {
  const { data } = await api.delete<Supplier>(`/suppliers/${id}`);
  return data;
}
