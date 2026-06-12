import { api } from '@/api/client';

export type ModifierItem = { id: string; name: string; priceDelta: number | string; sortOrder: number };
export type ModifierGroup = {
  id: string; name: string; minSelect: number; maxSelect: number;
  required: boolean; sortOrder: number; isActive: boolean; modifiers: ModifierItem[];
};
export type MenuItem = {
  id: string; name: string; description: string | null; price: number | string;
  categoryId: string | null; productId: string | null; prepStation: string | null;
  isAvailable: boolean; isActive: boolean; sortOrder: number;
  modifierGroups?: { modifierGroupId: string; sortOrder: number }[];
};

export type MenuItemBody = {
  name: string; price: number; description?: string; categoryId?: string | null;
  prepStation?: string; isAvailable?: boolean; sortOrder?: number; modifierGroupIds?: string[];
};
export type ModifierGroupBody = {
  name: string; minSelect?: number; maxSelect?: number; required?: boolean; sortOrder?: number;
  modifiers?: { id?: string; name: string; priceDelta?: number; sortOrder?: number }[];
};

export async function fetchMenuItems(params?: { q?: string; categoryId?: string; includeInactive?: boolean }): Promise<MenuItem[]> {
  const { data } = await api.get<MenuItem[]>('/fnb/menu', { params });
  return data;
}
export async function createMenuItem(body: MenuItemBody): Promise<MenuItem> {
  const { data } = await api.post<MenuItem>('/fnb/menu', body);
  return data;
}
export async function updateMenuItem(id: string, body: Partial<MenuItemBody> & { isActive?: boolean }): Promise<MenuItem> {
  const { data } = await api.patch<MenuItem>(`/fnb/menu/${id}`, body);
  return data;
}
export async function deleteMenuItem(id: string): Promise<MenuItem> {
  const { data } = await api.delete<MenuItem>(`/fnb/menu/${id}`);
  return data;
}

export async function fetchModifierGroups(includeInactive = false): Promise<ModifierGroup[]> {
  const { data } = await api.get<ModifierGroup[]>('/fnb/modifier-groups', { params: { includeInactive } });
  return data;
}
export async function createModifierGroup(body: ModifierGroupBody): Promise<ModifierGroup> {
  const { data } = await api.post<ModifierGroup>('/fnb/modifier-groups', body);
  return data;
}
export async function updateModifierGroup(id: string, body: Partial<ModifierGroupBody> & { isActive?: boolean }): Promise<ModifierGroup> {
  const { data } = await api.patch<ModifierGroup>(`/fnb/modifier-groups/${id}`, body);
  return data;
}
export async function deleteModifierGroup(id: string): Promise<ModifierGroup> {
  const { data } = await api.delete<ModifierGroup>(`/fnb/modifier-groups/${id}`);
  return data;
}
