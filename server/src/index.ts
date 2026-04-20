import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { nanoid } from "nanoid";
import {
  assertForwardDependency,
  categoryOrderMap,
  pruneInvalidDependencies,
} from "./validation.js";
import { readStore, writeStore } from "./store.js";
import type {
  Category,
  Dependency,
  Product,
  StoreData,
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

function sortCategories(cats: Category[]): Category[] {
  return [...cats].sort((a, b) => a.order - b.order);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/state", async (_req, res) => {
  const data = await readStore();
  res.json(data);
});

app.put("/api/state", async (req, res) => {
  try {
    const body = req.body as StoreData;
    if (
      !body ||
      !Array.isArray(body.categories) ||
      !Array.isArray(body.products) ||
      !Array.isArray(body.dependencies)
    ) {
      res.status(400).json({ error: "Invalid payload." });
      return;
    }
    const orderMap = categoryOrderMap(body.categories);
    for (const d of body.dependencies) {
      const check = assertForwardDependency(
        d.fromProductId,
        d.toProductId,
        body.products,
        orderMap
      );
      if (!check.ok) {
        res.status(400).json({ error: check.message });
        return;
      }
    }
    await writeStore(body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : "Import failed.",
    });
  }
});

app.get("/api/categories", async (_req, res) => {
  const data = await readStore();
  res.json(sortCategories(data.categories));
});

app.post("/api/categories", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "Name required." });
    return;
  }
  const data = await readStore();
  const maxOrder =
    data.categories.reduce((m, c) => Math.max(m, c.order), -1) + 1;
  const cat: Category = {
    id: nanoid(),
    name,
    order: maxOrder,
  };
  data.categories.push(cat);
  await writeStore(data);
  res.status(201).json(cat);
});

app.patch("/api/categories/:id", async (req, res) => {
  const data = await readStore();
  const cat = data.categories.find((c) => c.id === req.params.id);
  if (!cat) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (name) cat.name = name;
  }
  if (typeof req.body.order === "number" && Number.isFinite(req.body.order)) {
    cat.order = req.body.order;
  }
  data.dependencies = pruneInvalidDependencies(
    data.dependencies,
    data.products,
    data.categories
  );
  await writeStore(data);
  res.json(cat);
});

app.post("/api/categories/reorder", async (req, res) => {
  const ids = req.body?.orderedIds as string[] | undefined;
  if (!Array.isArray(ids) || !ids.length) {
    res.status(400).json({ error: "orderedIds required." });
    return;
  }
  const data = await readStore();
  const idSet = new Set(data.categories.map((c) => c.id));
  for (const id of ids) {
    if (!idSet.has(id)) {
      res.status(400).json({ error: `Unknown category id: ${id}` });
      return;
    }
  }
  ids.forEach((id, index) => {
    const c = data.categories.find((x) => x.id === id);
    if (c) c.order = index;
  });
  data.dependencies = pruneInvalidDependencies(
    data.dependencies,
    data.products,
    data.categories
  );
  await writeStore(data);
  res.json(sortCategories(data.categories));
});

app.delete("/api/categories/:id", async (req, res) => {
  const data = await readStore();
  const idx = data.categories.findIndex((c) => c.id === req.params.id);
  if (idx < 0) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  const removedId = data.categories[idx].id;
  data.categories.splice(idx, 1);
  data.products = data.products.filter((p) => p.categoryId !== removedId);
  const productIds = new Set(data.products.map((p) => p.id));
  data.dependencies = data.dependencies.filter(
    (d) =>
      productIds.has(d.fromProductId) && productIds.has(d.toProductId)
  );
  data.dependencies = pruneInvalidDependencies(
    data.dependencies,
    data.products,
    data.categories
  );
  await writeStore(data);
  res.status(204).send();
});

app.get("/api/products", async (_req, res) => {
  const data = await readStore();
  res.json(data.products);
});

app.post("/api/products", async (req, res) => {
  const categoryId = String(req.body?.categoryId ?? "");
  const name = String(req.body?.name ?? "").trim();
  const tags = Array.isArray(req.body?.tags)
    ? req.body.tags.map((t: unknown) => String(t))
    : [];
  if (!categoryId || !name) {
    res.status(400).json({ error: "categoryId and name required." });
    return;
  }
  const data = await readStore();
  if (!data.categories.some((c) => c.id === categoryId)) {
    res.status(400).json({ error: "Unknown category." });
    return;
  }
  const p: Product = {
    id: nanoid(),
    categoryId,
    name,
    tags,
  };
  data.products.push(p);
  await writeStore(data);
  res.status(201).json(p);
});

app.patch("/api/products/:id", async (req, res) => {
  const data = await readStore();
  const p = data.products.find((x) => x.id === req.params.id);
  if (!p) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (name) p.name = name;
  }
  if (req.body.categoryId !== undefined) {
    const cid = String(req.body.categoryId);
    if (!data.categories.some((c) => c.id === cid)) {
      res.status(400).json({ error: "Unknown category." });
      return;
    }
    p.categoryId = cid;
  }
  if (Array.isArray(req.body.tags)) {
    p.tags = req.body.tags.map((t: unknown) => String(t));
  }
  data.dependencies = pruneInvalidDependencies(
    data.dependencies,
    data.products,
    data.categories
  );
  await writeStore(data);
  res.json(p);
});

app.delete("/api/products/:id", async (req, res) => {
  const data = await readStore();
  const pid = req.params.id;
  const idx = data.products.findIndex((p) => p.id === pid);
  if (idx < 0) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  data.products.splice(idx, 1);
  data.dependencies = data.dependencies.filter(
    (d) => d.fromProductId !== pid && d.toProductId !== pid
  );
  await writeStore(data);
  res.status(204).send();
});

app.get("/api/dependencies", async (_req, res) => {
  const data = await readStore();
  res.json(data.dependencies);
});

app.post("/api/dependencies", async (req, res) => {
  const fromProductId = String(req.body?.fromProductId ?? "");
  const toProductId = String(req.body?.toProductId ?? "");
  if (!fromProductId || !toProductId) {
    res.status(400).json({ error: "fromProductId and toProductId required." });
    return;
  }
  if (fromProductId === toProductId) {
    res.status(400).json({ error: "Cannot depend on self." });
    return;
  }
  const data = await readStore();
  const orderMap = categoryOrderMap(data.categories);
  const check = assertForwardDependency(
    fromProductId,
    toProductId,
    data.products,
    orderMap
  );
  if (!check.ok) {
    res.status(400).json({ error: check.message });
    return;
  }
  if (
    data.dependencies.some(
      (d) =>
        d.fromProductId === fromProductId && d.toProductId === toProductId
    )
  ) {
    res.status(400).json({ error: "Dependency already exists." });
    return;
  }
  const d: Dependency = {
    id: nanoid(),
    fromProductId,
    toProductId,
  };
  data.dependencies.push(d);
  await writeStore(data);
  res.status(201).json(d);
});

app.delete("/api/dependencies/:id", async (req, res) => {
  const data = await readStore();
  const idx = data.dependencies.findIndex((d) => d.id === req.params.id);
  if (idx < 0) {
    res.status(404).json({ error: "Not found." });
    return;
  }
  data.dependencies.splice(idx, 1);
  await writeStore(data);
  res.status(204).send();
});

const clientDist = path.join(__dirname, "../../client/dist");
if (
  process.env.NODE_ENV === "production" &&
  fs.existsSync(clientDist)
) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const PORT = Number(process.env.PORT) || 3847;
app.listen(PORT, () => {
  console.log(`API http://localhost:${PORT}`);
});
