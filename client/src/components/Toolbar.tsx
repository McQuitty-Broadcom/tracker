import type { PathDirection } from "../lib/pathEngine";

type Props = {
  direction: PathDirection;
  onDirection: (d: PathDirection) => void;
  maxDepth: number | null;
  onMaxDepth: (v: number | null) => void;
  hideOffPath: boolean;
  onHideOffPath: (v: boolean) => void;
  onExport: () => void;
  selectedLabel: string | null;
};

export function Toolbar({
  direction,
  onDirection,
  maxDepth,
  onMaxDepth,
  hideOffPath,
  onHideOffPath,
  onExport,
  selectedLabel,
}: Props) {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <span className="toolbar-label">Path direction</span>
        <select
          className="toolbar-select"
          value={direction}
          onChange={(e) => onDirection(e.target.value as PathDirection)}
          aria-label="Path direction"
        >
          <option value="upstream">Upstream (depends on)</option>
          <option value="downstream">Downstream (needed by)</option>
        </select>
      </div>
      <div className="toolbar-group">
        <span className="toolbar-label">Max depth</span>
        <select
          className="toolbar-select"
          value={maxDepth === null ? "all" : String(maxDepth)}
          onChange={(e) => {
            const v = e.target.value;
            onMaxDepth(v === "all" ? null : Number(v));
          }}
          aria-label="Maximum path depth"
        >
          <option value="all">Unlimited</option>
          <option value="0">Selected only (0 hops)</option>
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <option key={n} value={String(n)}>
              {n} hop{n > 1 ? "s" : ""}
            </option>
          ))}
        </select>
      </div>
      <label className="toolbar-check">
        <input
          type="checkbox"
          checked={hideOffPath}
          onChange={(e) => onHideOffPath(e.target.checked)}
        />
        Hide products not on path
      </label>
      <button type="button" className="btn primary" onClick={onExport}>
        Export PDF…
      </button>
      {selectedLabel ? (
        <span className="toolbar-selected">
          Selected: <strong>{selectedLabel}</strong>
        </span>
      ) : (
        <span className="toolbar-selected muted">
          Select a product to highlight its dependency path.
        </span>
      )}
    </div>
  );
}
