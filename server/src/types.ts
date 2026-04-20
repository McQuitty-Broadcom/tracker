export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  tags: string[];
}

export interface Dependency {
  id: string;
  fromProductId: string;
  toProductId: string;
}

export interface StoreData {
  categories: Category[];
  products: Product[];
  dependencies: Dependency[];
}
