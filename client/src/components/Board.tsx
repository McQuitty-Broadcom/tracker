import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Category, Dependency, Product } from "../types";
import {
  computePathProductIds,
  dependencyPairsOnPath,
  visibleProducts,
} from "../lib/pathEngine";
import type { PathDirection } from "../lib/pathEngine";

type Props = {
  categories: Category[];
  products: Product[];
  dependencies: Dependency[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  direction: PathDirection;
  maxDepth: number | null;
  hideOffPath: boolean;
  exportMode?: boolean;
};

function sortCats(cats: Category[]): Category[] {
  return [...cats].sort((a, b) => a.order - b.order);
}

/** Smooth curve from upstream (exit right) → downstream (enter left), flat tangents at ports. */
function cubicDependencyPath(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): string {
  const dx = x1 - x0;
  const alpha = Math.min(160, Math.max(28, Math.abs(dx) * 0.35));
  const cx0 = x0 + alpha;
  const cy0 = y0;
  const cx1 = x1 - alpha;
  const cy1 = y1;
  return `M ${x0} ${y0} C ${cx0} ${cy0} ${cx1} ${cy1} ${x1} ${y1}`;
}

type EdgeSeg = {
  d: string;
  onPath: boolean;
  key: string;
};

export function Board({
  categories,
  products,
  dependencies,
  selectedId,
  onSelect,
  direction,
  maxDepth,
  hideOffPath,
  exportMode,
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [edges, setEdges] = useState<EdgeSeg[]>([]);

  const pathIds = useMemo(
    () =>
      computePathProductIds(selectedId, direction, dependencies, maxDepth),
    [selectedId, direction, dependencies, maxDepth]
  );

  const pathEdgeKeys = useMemo(
    () => dependencyPairsOnPath(dependencies, pathIds),
    [dependencies, pathIds]
  );

  const shownProducts = useMemo(
    () => visibleProducts(products, pathIds, hideOffPath, selectedId),
    [products, pathIds, hideOffPath, selectedId]
  );

  const ordered = sortCats(categories);
  const byCat = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const c of ordered) m.set(c.id, []);
    for (const p of shownProducts) {
      const arr = m.get(p.categoryId);
      if (arr) arr.push(p);
    }
    for (const arr of m.values())
      arr.sort((a, b) => a.name.localeCompare(b.name));
    return m;
  }, [ordered, shownProducts]);

  const measureEdges = useCallback(() => {
    const root = boardRef.current;
    if (!root) return;
    const rb = root.getBoundingClientRect();
    const next: EdgeSeg[] = [];

    for (const d of dependencies) {
      const fromEl = cardRefs.current.get(d.fromProductId);
      const toEl = cardRefs.current.get(d.toProductId);
      if (!fromEl || !toEl) continue;
      if (hideOffPath && selectedId) {
        if (!pathIds.has(d.fromProductId) || !pathIds.has(d.toProductId))
          continue;
      }
      const ab = fromEl.getBoundingClientRect();
      const bb = toEl.getBoundingClientRect();
      /* Exit from right edge of supplier, enter left edge of dependent */
      const x0 = ab.right - rb.left;
      const y0 = ab.top + ab.height / 2 - rb.top;
      const x1 = bb.left - rb.left;
      const y1 = bb.top + bb.height / 2 - rb.top;
      const dPath = cubicDependencyPath(x0, y0, x1, y1);
      const onPath = pathEdgeKeys.has(`${d.fromProductId}|${d.toProductId}`);
      next.push({ d: dPath, onPath, key: d.id });
    }
    setEdges(next);
  }, [
    dependencies,
    hideOffPath,
    selectedId,
    pathIds,
    pathEdgeKeys,
  ]);

  useLayoutEffect(() => {
    measureEdges();
  }, [measureEdges, shownProducts, categories]);

  useEffect(() => {
    const root = boardRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measureEdges());
    ro.observe(root);
    return () => ro.disconnect();
  }, [measureEdges]);

  const showHighlight = Boolean(selectedId);

  return (
    <div
      ref={boardRef}
      className={`board-wrap ${exportMode ? "board-export" : ""}`}
      data-export-root={exportMode ? "true" : undefined}
    >
      <div className="board-columns">
        {ordered.map((cat) => (
          <section key={cat.id} className="board-column">
            <header className="board-column-head">{cat.name}</header>
            <div className="board-cards">
              {(byCat.get(cat.id) ?? []).map((p) => {
                const onPath = !showHighlight || pathIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    ref={(el) => {
                      if (el) cardRefs.current.set(p.id, el);
                      else cardRefs.current.delete(p.id);
                    }}
                    data-product-id={p.id}
                    className={`board-card ${selectedId === p.id ? "selected" : ""} ${showHighlight ? (onPath ? "on-path" : "off-path") : ""}`}
                    onClick={() =>
                      onSelect(selectedId === p.id ? null : p.id)
                    }
                  >
                    <span className="board-card-name">{p.name}</span>
                    {p.tags?.length ? (
                      <span className="board-card-tags">
                        {p.tags.join(" · ")}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {/* Painted after columns so connectors stay visible on top of cards */}
      <svg className="board-edges" aria-hidden>
        <defs>
          <marker
            id="edge-arrow-normal"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              className="edge-arrow-fill edge-arrow-normal"
            />
          </marker>
          <marker
            id="edge-arrow-dim"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              className="edge-arrow-fill edge-arrow-dim"
            />
          </marker>
          <marker
            id="edge-arrow-path"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              className="edge-arrow-fill edge-arrow-path"
            />
          </marker>
        </defs>
        {edges.map((seg) => {
          const cls = !showHighlight
            ? "edge edge-normal"
            : seg.onPath
              ? "edge edge-path"
              : "edge edge-dim";
          const marker =
            !showHighlight
              ? "url(#edge-arrow-normal)"
              : seg.onPath
                ? "url(#edge-arrow-path)"
                : "url(#edge-arrow-dim)";
          return (
            <path
              key={seg.key}
              d={seg.d}
              fill="none"
              className={cls}
              markerEnd={marker}
            />
          );
        })}
      </svg>
    </div>
  );
}
