import { useCallback, useEffect, useRef, useState } from "react";
import { Board } from "./components/Board";
import { ExportModal, type PdfMode } from "./components/ExportModal";
import { Toolbar } from "./components/Toolbar";
import { fetchState } from "./api";
import type { PathDirection } from "./lib/pathEngine";
import type { StoreData } from "./types";
import { SettingsPage } from "./pages/Settings";

type View = "board" | "settings";

export function App() {
  const [view, setView] = useState<View>("board");
  const [data, setData] = useState<StoreData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [direction, setDirection] = useState<PathDirection>("upstream");
  const [maxDepth, setMaxDepth] = useState<number | null>(null);
  const [hideOffPath, setHideOffPath] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [pdfMode, setPdfMode] = useState<PdfMode>("full");
  const exportTargetRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const s = await fetchState();
      setData(s);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load data");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectedName =
    selectedId && data
      ? data.products.find((p) => p.id === selectedId)?.name ?? null
      : null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-title">Dependency board</span>
          <span className="brand-sub">Product dependencies by category</span>
        </div>
        <nav className="nav">
          <button
            type="button"
            className={`nav-btn ${view === "board" ? "active" : ""}`}
            onClick={() => setView("board")}
          >
            Board
          </button>
          <button
            type="button"
            className={`nav-btn ${view === "settings" ? "active" : ""}`}
            onClick={() => setView("settings")}
          >
            Configuration
          </button>
        </nav>
      </header>

      {loadError ? (
        <div className="banner-error banner-page">
          <p>
            {loadError}. Ensure the API is running (e.g.{" "}
            <code>npm run dev -w server</code>).
          </p>
          <button type="button" className="btn" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      ) : null}

      {data && view === "board" ? (
        <>
          <Toolbar
            direction={direction}
            onDirection={setDirection}
            maxDepth={maxDepth}
            onMaxDepth={setMaxDepth}
            hideOffPath={hideOffPath}
            onHideOffPath={setHideOffPath}
            onExport={() => setExportOpen(true)}
            selectedLabel={selectedName}
          />
          <div className="board-outer" ref={exportTargetRef}>
            <Board
              categories={data.categories}
              products={data.products}
              dependencies={data.dependencies}
              selectedId={selectedId}
              onSelect={setSelectedId}
              direction={direction}
              maxDepth={maxDepth}
              hideOffPath={hideOffPath}
            />
          </div>
          <ExportModal
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            targetRef={exportTargetRef}
            mode={pdfMode}
            onModeChange={setPdfMode}
            title="dependency-board"
            pathExportReady={Boolean(selectedId)}
          />
        </>
      ) : null}

      {data && view === "settings" ? (
        <SettingsPage
          categories={data.categories}
          products={data.products}
          dependencies={data.dependencies}
          onReload={reload}
        />
      ) : null}

      {!data && !loadError ? (
        <p className="muted padded">Loading…</p>
      ) : null}
    </div>
  );
}
