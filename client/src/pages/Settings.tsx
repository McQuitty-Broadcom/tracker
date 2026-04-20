import { useMemo, useState } from "react";
import type { Category, Dependency, Product } from "../types";
import {
  createCategory,
  createDependency,
  createProduct,
  deleteCategory,
  deleteDependency,
  deleteProduct,
  patchCategory,
  patchProduct,
  putState,
  reorderCategories,
} from "../api";

type Props = {
  categories: Category[];
  products: Product[];
  dependencies: Dependency[];
  onReload: () => Promise<void>;
};

function sortCats(cats: Category[]): Category[] {
  return [...cats].sort((a, b) => a.order - b.order);
}

export function SettingsPage({
  categories,
  products,
  dependencies,
  onReload,
}: Props) {
  const [catName, setCatName] = useState("");
  const [productName, setProductName] = useState("");
  const [productCat, setProductCat] = useState("");
  const [depFrom, setDepFrom] = useState("");
  const [depTo, setDepTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const ordered = useMemo(() => sortCats(categories), [categories]);

  const orderMap = useMemo(() => {
    const m = new Map<string, number>();
    ordered.forEach((c, i) => m.set(c.id, i));
    return m;
  }, [ordered]);

  function forwardOk(fromId: string, toId: string): boolean {
    const a = products.find((p) => p.id === fromId);
    const b = products.find((p) => p.id === toId);
    if (!a || !b) return false;
    const oa = orderMap.get(a.categoryId);
    const ob = orderMap.get(b.categoryId);
    if (oa === undefined || ob === undefined) return false;
    return oa < ob;
  }

  async function handleAddCategory() {
    setError(null);
    try {
      await createCategory(catName);
      setCatName("");
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleMoveCategory(id: string, dir: -1 | 1) {
    const idx = ordered.findIndex((c) => c.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= ordered.length) return;
    const ids = ordered.map((c) => c.id);
    const t = ids[idx];
    ids[idx] = ids[next];
    ids[next] = t;
    setError(null);
    try {
      await reorderCategories(ids);
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function exportJson() {
    setError(null);
    try {
      const r = await fetch("/api/state");
      const data = await r.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dependency-board-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  async function importJson(file: File | null) {
    if (!file) return;
    setImportBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as {
        categories: Category[];
        products: Product[];
        dependencies: Dependency[];
      };
      await putState(data);
      await onReload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  return (
    <div className="settings">
      <h1>Configuration</h1>
      <p className="settings-lead">
        Categories define board columns (left to right). Dependencies must go
        from an earlier column to a later column.
      </p>
      {error ? <p className="banner-error">{error}</p> : null}

      <section className="settings-section">
        <h2>Categories</h2>
        <ul className="settings-list">
          {ordered.map((c, i) => (
            <li key={c.id} className="settings-row">
              <button
                type="button"
                className="btn sm"
                disabled={i === 0}
                onClick={() => void handleMoveCategory(c.id, -1)}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="btn sm"
                disabled={i === ordered.length - 1}
                onClick={() => void handleMoveCategory(c.id, 1)}
                aria-label="Move down"
              >
                ↓
              </button>
              <input
                className="input"
                defaultValue={c.name}
                key={c.id}
                onBlur={async (e) => {
                  const name = e.target.value.trim();
                  if (name && name !== c.name) {
                    try {
                      await patchCategory(c.id, { name });
                      await onReload();
                    } catch {
                      /* keep */
                    }
                  }
                }}
              />
              <button
                type="button"
                className="btn danger sm"
                onClick={async () => {
                  if (!confirm(`Delete category “${c.name}” and its products?`))
                    return;
                  try {
                    await deleteCategory(c.id);
                    await onReload();
                  } catch (er) {
                    setError(er instanceof Error ? er.message : "Failed");
                  }
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        <div className="settings-add">
          <input
            className="input"
            placeholder="New category name"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
          />
          <button
            type="button"
            className="btn primary"
            onClick={() => void handleAddCategory()}
          >
            Add category
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2>Products</h2>
        <div className="settings-add">
          <select
            className="input"
            value={productCat}
            onChange={(e) => setProductCat(e.target.value)}
            aria-label="Category for new product"
          >
            <option value="">Category…</option>
            {ordered.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Product name"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />
          <button
            type="button"
            className="btn primary"
            onClick={async () => {
              if (!productCat || !productName.trim()) return;
              setError(null);
              try {
                await createProduct({
                  categoryId: productCat,
                  name: productName.trim(),
                });
                setProductName("");
                await onReload();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Add product
          </button>
        </div>
        <ul className="settings-table">
          {products.map((p) => {
            const cat = categories.find((c) => c.id === p.categoryId);
            return (
              <li key={p.id} className="settings-row">
                <span className="muted">{cat?.name ?? "?"}</span>
                <input
                  className="input grow"
                  defaultValue={p.name}
                  onBlur={async (e) => {
                    const name = e.target.value.trim();
                    if (name && name !== p.name) {
                      try {
                        await patchProduct(p.id, { name });
                        await onReload();
                      } catch {
                        /* */
                      }
                    }
                  }}
                />
                <select
                  className="input"
                  defaultValue={p.categoryId}
                  onChange={async (e) => {
                    try {
                      await patchProduct(p.id, { categoryId: e.target.value });
                      await onReload();
                    } catch (er) {
                      setError(er instanceof Error ? er.message : "Failed");
                    }
                  }}
                  aria-label="Category"
                >
                  {ordered.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn danger sm"
                  onClick={async () => {
                    if (!confirm(`Delete product “${p.name}”?`)) return;
                    try {
                      await deleteProduct(p.id);
                      await onReload();
                    } catch (er) {
                      setError(er instanceof Error ? er.message : "Failed");
                    }
                  }}
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="settings-section">
        <h2>Dependencies</h2>
        <p className="muted small">
          “From” is upstream; “To” depends on “From”. Only forward links are
          allowed.
        </p>
        <div className="settings-add deps">
          <select
            className="input"
            value={depFrom}
            onChange={(e) => setDepFrom(e.target.value)}
            aria-label="From product"
          >
            <option value="">From…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="deps-arrow">→</span>
          <select
            className="input"
            value={depTo}
            onChange={(e) => setDepTo(e.target.value)}
            aria-label="To product"
          >
            <option value="">To…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn primary"
            disabled={!depFrom || !depTo || !forwardOk(depFrom, depTo)}
            onClick={async () => {
              setError(null);
              try {
                await createDependency({ fromProductId: depFrom, toProductId: depTo });
                setDepFrom("");
                setDepTo("");
                await onReload();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Add dependency
          </button>
        </div>
        <ul className="settings-list">
          {dependencies.map((d) => {
            const a = products.find((p) => p.id === d.fromProductId);
            const b = products.find((p) => p.id === d.toProductId);
            return (
              <li key={d.id} className="settings-row">
                <span>
                  {a?.name ?? "?"} → {b?.name ?? "?"}
                </span>
                <button
                  type="button"
                  className="btn danger sm"
                  onClick={async () => {
                    try {
                      await deleteDependency(d.id);
                      await onReload();
                    } catch (er) {
                      setError(er instanceof Error ? er.message : "Failed");
                    }
                  }}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="settings-section">
        <h2>Import / export</h2>
        <p className="muted small">
          Full JSON snapshot of categories, products, and dependencies.
        </p>
        <div className="settings-io">
          <button type="button" className="btn" onClick={() => void exportJson()}>
            Download JSON
          </button>
          <label className="btn file-label">
            {importBusy ? "Importing…" : "Import JSON"}
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              disabled={importBusy}
              onChange={(e) => void importJson(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
