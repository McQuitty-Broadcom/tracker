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

/**
 * Option C (hybrid): smooth dependency chord from supplier right edge → dependent left edge,
 * horizontal tangents so the curve reads left-to-right (easier to trace than orthogonal bus).
 */
function cubicDependencyPath(
  x0: number,
  y0: number,
  x1: number,
  y1: number
): string {
  const dx = x1 - x0;
  const lift = Math.min(100, Math.max(24, Math.abs(dx) * 0.08));
  const alpha = Math.min(180, Math.max(40, Math.abs(dx) * 0.38));
  const cx0 = x0 + alpha;
  const cx1 = x1 - alpha;
  const bend = Math.min(lift * 0.35, 36);
  return `M ${x0} ${y0} C ${cx0} ${y0 - bend} ${cx1} ${y1 - bend} ${x1} ${y1}`;
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

    for (const dep of dependencies) {
      const fromEl = cardRefs.current.get(dep.fromProductId);
      const toEl = cardRefs.current.get(dep.toProductId);
      if (!fromEl || !toEl) continue;
      if (hideOffPath && selectedId) {
        if (!pathIds.has(dep.fromProductId) || !pathIds.has(dep.toProductId))
          continue;
      }

      const fr = fromEl.getBoundingClientRect();
      const tr = toEl.getBoundingClientRect();

      const x0 = fr.right - rb.left;
      const y0 = fr.top + fr.height / 2 - rb.top;
      const x1 = tr.left - rb.left;
      const y1 = tr.top + tr.height / 2 - rb.top;

      const onPath = pathEdgeKeys.has(
        `${dep.fromProductId}|${dep.toProductId}`
      );

      next.push({
        d: cubicDependencyPath(x0, y0, x1, y1),
        onPath,
        key: dep.id,
      });
    }

    /* Paint non-path edges first, path edges on top for clarity (Option C) */
    next.sort((a, b) => {
      if (a.onPath === b.onPath) return 0;
      return a.onPath ? 1 : -1;
    });

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

  /* Option G: keep selected product in view */
  useEffect(() => {
    if (!selectedId) return;
    const el = cardRefs.current.get(selectedId);
    el?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedId]);

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
            markerWidth="8"
            markerHeight="8"
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
