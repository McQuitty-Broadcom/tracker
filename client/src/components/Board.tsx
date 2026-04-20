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

const COL_PAD = 10;
const BUS_MARGIN = 28;
const LANE_GAP = 14;

type Pt = { x: number; y: number };

function polylineD(pts: Pt[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${pts[i].y}`;
  }
  return d;
}

/** Assign non-overlapping horizontal bus lanes so segments that share x-range don't stack on one line. */
function assignBusLanes(
  spans: { minX: number; maxX: number; index: number }[]
): Map<number, number> {
  const sorted = [...spans].sort((a, b) => a.minX - b.minX || a.maxX - b.maxX);
  const laneIntervals: [number, number][][] = [];
  const result = new Map<number, number>();

  function overlaps(ints: [number, number][], lo: number, hi: number): boolean {
    return ints.some(([u, v]) => !(hi < u || lo > v));
  }

  for (const s of sorted) {
    const lo = Math.min(s.minX, s.maxX);
    const hi = Math.max(s.minX, s.maxX);
    let lane = 0;
    while (lane < laneIntervals.length) {
      if (!overlaps(laneIntervals[lane], lo, hi)) break;
      lane++;
    }
    if (!laneIntervals[lane]) laneIntervals[lane] = [];
    laneIntervals[lane].push([lo, hi]);
    result.set(s.index, lane);
  }
  return result;
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
  const columnRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [edges, setEdges] = useState<EdgeSeg[]>([]);
  const [railPadBottom, setRailPadBottom] = useState(96);

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

  const productById = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const measureEdges = useCallback(() => {
    const root = boardRef.current;
    if (!root) return;
    const rb = root.getBoundingClientRect();

    let maxCardBottom = 0;
    for (const el of cardRefs.current.values()) {
      const cr = el.getBoundingClientRect();
      maxCardBottom = Math.max(maxCardBottom, cr.bottom - rb.top);
    }

    type Draft = {
      dep: Dependency;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      xRf: number;
      xLt: number;
      minX: number;
      maxX: number;
      onPath: boolean;
    };

    const drafts: Draft[] = [];

    dependencies.forEach((dep) => {
      const fromEl = cardRefs.current.get(dep.fromProductId);
      const toEl = cardRefs.current.get(dep.toProductId);
      if (!fromEl || !toEl) return;
      if (hideOffPath && selectedId) {
        if (!pathIds.has(dep.fromProductId) || !pathIds.has(dep.toProductId))
          return;
      }

      const fp = productById.get(dep.fromProductId);
      const tp = productById.get(dep.toProductId);
      if (!fp || !tp) return;

      const colFrom = columnRefs.current.get(fp.categoryId);
      const colTo = columnRefs.current.get(tp.categoryId);
      if (!colFrom || !colTo) return;

      const fr = fromEl.getBoundingClientRect();
      const tr = toEl.getBoundingClientRect();
      const cFrom = colFrom.getBoundingClientRect();
      const cTo = colTo.getBoundingClientRect();

      const x0 = fr.right - rb.left;
      const y0 = fr.top + fr.height / 2 - rb.top;
      const x1 = tr.left - rb.left;
      const y1 = tr.top + tr.height / 2 - rb.top;

      /* Rails sit in column margins so vertical segments avoid card stacks */
      const xRf = Math.max(x0 + 2, cFrom.right - rb.left - COL_PAD);
      const xLt = Math.min(x1 - 2, cTo.left - rb.left + COL_PAD);

      if (xRf >= xLt - 2) return;

      const minX = Math.min(xRf, xLt);
      const maxX = Math.max(xRf, xLt);
      const onPath = pathEdgeKeys.has(
        `${dep.fromProductId}|${dep.toProductId}`
      );

      drafts.push({
        dep,
        x0,
        y0,
        x1,
        y1,
        xRf,
        xLt,
        minX,
        maxX,
        onPath,
      });
    });

    const lanes = assignBusLanes(
      drafts.map((d, index) => ({
        minX: d.minX,
        maxX: d.maxX,
        index,
      }))
    );

    let maxLane = 0;
    const next: EdgeSeg[] = [];

    drafts.forEach((d, index) => {
      const lane = lanes.get(index) ?? 0;
      maxLane = Math.max(maxLane, lane);
      const yBus =
        maxCardBottom + BUS_MARGIN + lane * LANE_GAP;

      const pts: Pt[] = [
        { x: d.x0, y: d.y0 },
        { x: d.xRf, y: d.y0 },
        { x: d.xRf, y: yBus },
        { x: d.xLt, y: yBus },
        { x: d.xLt, y: d.y1 },
        { x: d.x1, y: d.y1 },
      ];

      next.push({
        d: polylineD(pts),
        onPath: d.onPath,
        key: d.dep.id,
      });
    });

    setEdges(next);
    setRailPadBottom(
      Math.max(96, BUS_MARGIN + maxLane * LANE_GAP + LANE_GAP * 3)
    );
  }, [
    dependencies,
    hideOffPath,
    selectedId,
    pathIds,
    pathEdgeKeys,
    productById,
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
      style={{ paddingBottom: railPadBottom }}
    >
      <div className="board-columns">
        {ordered.map((cat) => (
          <section
            key={cat.id}
            className="board-column"
            ref={(el) => {
              if (el) columnRefs.current.set(cat.id, el);
              else columnRefs.current.delete(cat.id);
            }}
          >
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
