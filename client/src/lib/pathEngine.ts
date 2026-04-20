import type { Dependency, Product } from "../types";

export type PathDirection = "upstream" | "downstream";

/**
 * Edge `from → to`: `to` depends on `from` (forward along columns).
 * - Upstream from P: products P depends on (incoming to P).
 * - Downstream from P: products that depend on P (outgoing from P).
 */
export function computePathProductIds(
  selectedId: string | null,
  direction: PathDirection,
  dependencies: Dependency[],
  maxDepth: number | null
): Set<string> {
  if (!selectedId) return new Set();

  const downstream = new Map<string, string[]>();
  const upstream = new Map<string, string[]>();

  for (const d of dependencies) {
    if (!downstream.has(d.fromProductId))
      downstream.set(d.fromProductId, []);
    downstream.get(d.fromProductId)!.push(d.toProductId);

    if (!upstream.has(d.toProductId)) upstream.set(d.toProductId, []);
    upstream.get(d.toProductId)!.push(d.fromProductId);
  }

  const adj = direction === "downstream" ? downstream : upstream;
  const visited = new Set<string>([selectedId]);
  const queue: { id: string; depth: number }[] = [
    { id: selectedId, depth: 0 },
  ];

  while (queue.length) {
    const { id, depth } = queue.shift()!;
    const nbrs = adj.get(id) ?? [];
    for (const n of nbrs) {
      const nextDepth = depth + 1;
      if (maxDepth !== null && nextDepth > maxDepth) continue;
      if (visited.has(n)) continue;
      visited.add(n);
      queue.push({ id: n, depth: nextDepth });
    }
  }

  return visited;
}

export function dependencyPairsOnPath(
  dependencies: Dependency[],
  pathIds: Set<string>
): Set<string> {
  const keys = new Set<string>();
  for (const d of dependencies) {
    if (pathIds.has(d.fromProductId) && pathIds.has(d.toProductId)) {
      keys.add(`${d.fromProductId}|${d.toProductId}`);
    }
  }
  return keys;
}

export function visibleProducts(
  products: Product[],
  pathIds: Set<string>,
  hideOffPath: boolean,
  selectedId: string | null
): Product[] {
  if (!hideOffPath || !selectedId) return products;
  return products.filter((p) => pathIds.has(p.id));
}
