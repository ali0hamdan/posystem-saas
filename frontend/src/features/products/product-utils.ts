import type { Product } from '@/types/product';

export function isLowStock(product: Pick<Product, 'quantity' | 'minStock'>): boolean {
  return product.quantity <= product.minStock;
}

export function categoryLabel(
  product: Pick<Product, 'category' | 'categoryId'>,
  categoryLookup: Map<string, string>,
): string {
  if (product.category?.name) return product.category.name;
  const name = categoryLookup.get(product.categoryId);
  return name ?? '—';
}
