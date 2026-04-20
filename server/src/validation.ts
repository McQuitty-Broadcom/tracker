import type { Category, Dependency, Product } from "./types.js";

export function categoryOrderMap(
  categories: Category[]
): Map<string, number> {
  const sorted = [...categories].sort((a, b) => a.order - b.order);
  const map = new Map<string, number>();
  sorted.forEach((c, i) => map.set(c.id, i));
  return map;
}

/** Forward-only: from-product must be in an earlier column than to-product. */
export function assertForwardDependency(
  fromProductId: string,
  toProductId: string,
  products: Product[],
  orderMap: Map<string, number>
): { ok: true } | { ok: false; message: string } {
  const from = products.find((p) => p.id === fromProductId);
  const to = products.find((p) => p.id === toProductId);
  if (!from || !to) {
    return { ok: false, message: "Unknown product in dependency." };
  }
  const fromOrd = orderMap.get(from.categoryId);
  const toOrd = orderMap.get(to.categoryId);
  if (fromOrd === undefined || toOrd === undefined) {
    return { ok: false, message: "Product category missing from board." };
  }
  if (fromOrd >= toOrd) {
    return {
      ok: false,
      message:
        "Dependencies must go forward to a later category (not same or earlier column).",
    };
  }
  return { ok: true };
}

/** Remove dependencies that violate forward-only after reorder/delete. */
export function pruneInvalidDependencies(
  deps: Dependency[],
  products: Product[],
  categories: Category[]
): Dependency[] {
  const orderMap = categoryOrderMap(categories);
  return deps.filter((d) => {
    const r = assertForwardDependency(
      d.fromProductId,
      d.toProductId,
      products,
      orderMap
    );
    return r.ok;
  });
}
