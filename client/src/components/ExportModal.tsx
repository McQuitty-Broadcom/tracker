import { useState, type RefObject } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export type PdfMode = "full" | "path";

type Props = {
  open: boolean;
  onClose: () => void;
  targetRef: RefObject<HTMLDivElement | null>;
  mode: PdfMode;
  onModeChange: (m: PdfMode) => void;
  title: string;
  /** When true, path snapshot export is allowed (product selected). */
  pathExportReady: boolean;
};

export function ExportModal({
  open,
  onClose,
  targetRef,
  mode,
  onModeChange,
  title,
  pathExportReady,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function runExport() {
    const el = targetRef.current;
    if (!el) {
      setError("Nothing to export.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "path" && !pathExportReady) {
        setError("Select a product on the board before a path snapshot export.");
        return;
      }
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#0f1419",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: landscapeForCanvas(canvas) ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageW / canvas.width, pageH / canvas.height) * 0.95;
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      const x = (pageW - imgW) / 2;
      const y = (pageH - imgH) / 2;
      pdf.addImage(imgData, "PNG", x, y, imgW, imgH);
      const suffix = mode === "full" ? "full-board" : "path";
      pdf.save(`${sanitize(title)}-${suffix}.pdf`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-labelledby="export-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="export-title">Export PDF</h2>
        <p className="modal-desc">
          Captures the board area as shown. For <strong>path snapshot</strong>,
          select a product first and optionally enable “Hide products not on path”.
        </p>
        <fieldset className="modal-fieldset">
          <legend className="sr-only">Export scope</legend>
          <label className="radio-row">
            <input
              type="radio"
              name="pdf-mode"
              checked={mode === "full"}
              onChange={() => onModeChange("full")}
            />
            Full board (all categories and visible products)
          </label>
          <label className="radio-row">
            <input
              type="radio"
              name="pdf-mode"
              checked={mode === "path"}
              onChange={() => onModeChange("path")}
            />
            Path snapshot (recommended with a selected product)
          </label>
        </fieldset>
        {error ? <p className="modal-error">{error}</p> : null}
        <div className="modal-actions">
          <button
            type="button"
            className="btn"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => void runExport()}
            disabled={busy}
          >
            {busy ? "Generating…" : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

function landscapeForCanvas(c: HTMLCanvasElement): boolean {
  return c.width >= c.height;
}

function sanitize(s: string): string {
  return s.replace(/[^\w\-]+/g, "-").replace(/^-|-$/g, "") || "dependency-board";
}
