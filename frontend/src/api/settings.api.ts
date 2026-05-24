import { api } from '@/api/client';
import type { PatchStoreSettingsBody, StoreSettings } from '@/types/store-settings';

export async function fetchStoreSettings(): Promise<StoreSettings> {
  const { data } = await api.get<StoreSettings>('/settings');
  return data;
}

export async function patchStoreSettings(body: PatchStoreSettingsBody): Promise<StoreSettings> {
  const { data } = await api.patch<StoreSettings>('/settings', body);
  return data;
}
