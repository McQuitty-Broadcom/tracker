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

type Line = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
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
  const [lines, setLines] = useState<Line[]>([]);

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
    const next: Line[] = [];
    const showHighlight = Boolean(selectedId);

    for (const d of dependencies) {
      const a = cardRefs.current.get(d.fromProductId);
      const b = cardRefs.current.get(d.toProductId);
      if (!a || !b) continue;
      if (hideOffPath && selectedId) {
        if (!pathIds.has(d.fromProductId) || !pathIds.has(d.toProductId))
          continue;
      }
      const ab = a.getBoundingClientRect();
      const bb = b.getBoundingClientRect();
      const x1 = ab.left + ab.width / 2 - rb.left;
      const y1 = ab.top + ab.height / 2 - rb.top;
      const x2 = bb.left + bb.width / 2 - rb.left;
      const y2 = bb.top + bb.height / 2 - rb.top;
      const onPath = pathEdgeKeys.has(`${d.fromProductId}|${d.toProductId}`);
      next.push({ x1, y1, x2, y2, onPath, key: d.id });
    }
    setLines(next);
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
      <svg className="board-edges" aria-hidden>
        {lines.map((ln) => (
          <line
            key={ln.key}
            x1={ln.x1}
            y1={ln.y1}
            x2={ln.x2}
            y2={ln.y2}
            className={
              !showHighlight
                ? "edge edge-normal"
                : ln.onPath
                  ? "edge edge-path"
                  : "edge edge-dim"
            }
          />
        ))}
      </svg>
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
    </div>
  );
}
