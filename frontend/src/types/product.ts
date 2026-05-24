export type ProductCategory = {
  id: string;
  name: string;
};

export type ProductSupplier = {
  id: string;
  name: string;
};

export type Product = {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  categoryId: string;
  supplierId: string | null;
  costPrice: string | number;
  sellingPrice: string | number;
  quantity: number;
  minStock: number;
  unitType: string;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category?: ProductCategory | null;
  supplier?: ProductSupplier | null;
};
