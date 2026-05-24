import { api } from '@/api/client';
import type { Category } from '@/types/category';
import type { PaginatedResponse } from '@/types/paginated';

export type ListCategoriesParams = {
  page?: number;
  limit?: number;
  q?: string;
  includeInactive?: boolean;
};

export type CategoryBody = {
  name: string;
  description?: string;
  isActive?: boolean;
};

export async function fetchCategories(
  params?: ListCategoriesParams,
): Promise<PaginatedResponse<Category>> {
  const { data } = await api.get<PaginatedResponse<Category>>('/categories', {
    params: { limit: 200, page: 1, ...params },
  });
  return data;
}

export async function createCategory(body: CategoryBody): Promise<Category> {
  const { data } = await api.post<Category>('/categories', body);
  return data;
}

export async function updateCategory(id: string, body: Partial<CategoryBody>): Promise<Category> {
  const { data } = await api.patch<Category>(`/categories/${id}`, body);
  return data;
}

export async function deactivateCategory(id: string): Promise<Category> {
  const { data } = await api.delete<Category>(`/categories/${id}`);
  return data;
}
