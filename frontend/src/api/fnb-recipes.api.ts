import { api } from '@/api/client';

export type RecipeIngredient = {
  id: string; productId: string; quantity: number | string; unit: string | null;
  product?: { id: string; name: string; unitType: string } | null;
};
export type Recipe = { id: string; menuItemId: string; yieldQty: number; notes: string | null; ingredients: RecipeIngredient[] };
export type RecipeListItem = { id: string; menuItemId: string; yieldQty: number; menuItem: { id: string; name: string }; _count: { ingredients: number } };
export type RecipeDetail = { menuItem: { id: string; name: string }; recipe: Recipe | null };
export type UpsertRecipeBody = { yieldQty?: number; notes?: string; ingredients: { productId: string; quantity: number; unit?: string }[] };

export async function fetchRecipes(): Promise<RecipeListItem[]> {
  const { data } = await api.get<RecipeListItem[]>('/fnb/recipes');
  return data;
}
export async function getRecipe(menuItemId: string): Promise<RecipeDetail> {
  const { data } = await api.get<RecipeDetail>(`/fnb/recipes/${menuItemId}`);
  return data;
}
export async function upsertRecipe(menuItemId: string, body: UpsertRecipeBody): Promise<RecipeDetail> {
  const { data } = await api.put<RecipeDetail>(`/fnb/recipes/${menuItemId}`, body);
  return data;
}
export async function deleteRecipe(menuItemId: string): Promise<{ deleted: boolean }> {
  const { data } = await api.delete<{ deleted: boolean }>(`/fnb/recipes/${menuItemId}`);
  return data;
}
