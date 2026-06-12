import { api } from '@/api/client';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE';

export type DiningArea = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  _count?: { tables: number };
};

export type RestaurantTable = {
  id: string;
  label: string;
  seats: number;
  status: TableStatus;
  diningAreaId: string | null;
  posX: number | null;
  posY: number | null;
  isActive: boolean;
  diningArea?: { id: string; name: string } | null;
};

export type DiningAreaBody = { name: string; sortOrder?: number; isActive?: boolean };
export type TableBody = {
  label: string;
  seats?: number;
  diningAreaId?: string | null;
  status?: TableStatus;
};

export async function fetchDiningAreas(includeInactive = false): Promise<DiningArea[]> {
  const { data } = await api.get<DiningArea[]>('/fnb/dining-areas', { params: { includeInactive } });
  return data;
}
export async function createDiningArea(body: DiningAreaBody): Promise<DiningArea> {
  const { data } = await api.post<DiningArea>('/fnb/dining-areas', body);
  return data;
}
export async function updateDiningArea(id: string, body: Partial<DiningAreaBody>): Promise<DiningArea> {
  const { data } = await api.patch<DiningArea>(`/fnb/dining-areas/${id}`, body);
  return data;
}
export async function deleteDiningArea(id: string): Promise<DiningArea> {
  const { data } = await api.delete<DiningArea>(`/fnb/dining-areas/${id}`);
  return data;
}

export async function fetchTables(params?: { areaId?: string; status?: TableStatus; includeInactive?: boolean }): Promise<RestaurantTable[]> {
  const { data } = await api.get<RestaurantTable[]>('/fnb/tables', { params });
  return data;
}
export async function createTable(body: TableBody): Promise<RestaurantTable> {
  const { data } = await api.post<RestaurantTable>('/fnb/tables', body);
  return data;
}
export async function updateTable(id: string, body: Partial<TableBody> & { isActive?: boolean }): Promise<RestaurantTable> {
  const { data } = await api.patch<RestaurantTable>(`/fnb/tables/${id}`, body);
  return data;
}
export async function setTableStatus(id: string, status: TableStatus): Promise<RestaurantTable> {
  const { data } = await api.patch<RestaurantTable>(`/fnb/tables/${id}/status`, { status });
  return data;
}
export async function deleteTable(id: string): Promise<RestaurantTable> {
  const { data } = await api.delete<RestaurantTable>(`/fnb/tables/${id}`);
  return data;
}
