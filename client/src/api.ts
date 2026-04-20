import type {
  Category,
  Dependency,
  Product,
  StoreData,
} from "./types";

const json = (r: Response) => {
  if (!r.ok) throw new Error(r.statusText || `HTTP ${r.status}`);
  return r.json();
};

export async function fetchState(): Promise<StoreData> {
  const r = await fetch("/api/state");
  return json(r) as Promise<StoreData>;
}

export async function putState(body: StoreData): Promise<void> {
  const r = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || r.statusText);
  }
}

export async function fetchCategories(): Promise<Category[]> {
  const r = await fetch("/api/categories");
  return json(r) as Promise<Category[]>;
}

export async function createCategory(name: string): Promise<Category> {
  const r = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error(await r.text());
  return json(r) as Promise<Category>;
}

export async function patchCategory(
  id: string,
  patch: Partial<Pick<Category, "name" | "order">>
): Promise<Category> {
  const r = await fetch(`/api/categories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(await r.text());
  return json(r) as Promise<Category>;
}

export async function deleteCategory(id: string): Promise<void> {
  const r = await fetch(`/api/categories/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
}

export async function reorderCategories(orderedIds: string[]): Promise<Category[]> {
  const r = await fetch("/api/categories/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
  if (!r.ok) throw new Error(await r.text());
  return json(r) as Promise<Category[]>;
}

export async function fetchProducts(): Promise<Product[]> {
  const r = await fetch("/api/products");
  return json(r) as Promise<Product[]>;
}

export async function createProduct(body: {
  categoryId: string;
  name: string;
  tags?: string[];
}): Promise<Product> {
  const r = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return json(r) as Promise<Product>;
}

export async function patchProduct(
  id: string,
  patch: Partial<Pick<Product, "name" | "categoryId" | "tags">>
): Promise<Product> {
  const r = await fetch(`/api/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(await r.text());
  return json(r) as Promise<Product>;
}

export async function deleteProduct(id: string): Promise<void> {
  const r = await fetch(`/api/products/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
}

export async function fetchDependencies(): Promise<Dependency[]> {
  const r = await fetch("/api/dependencies");
  return json(r) as Promise<Dependency[]>;
}

export async function createDependency(body: {
  fromProductId: string;
  toProductId: string;
}): Promise<Dependency> {
  const r = await fetch("/api/dependencies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || await r.text());
  }
  return json(r) as Promise<Dependency>;
}

export async function deleteDependency(id: string): Promise<void> {
  const r = await fetch(`/api/dependencies/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
}
