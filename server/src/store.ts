import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StoreData } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data", "store.json");

const emptyStore = (): StoreData => ({
  categories: [],
  products: [],
  dependencies: [],
});

export async function readStore(): Promise<StoreData> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const data = JSON.parse(raw) as StoreData;
    if (!Array.isArray(data.categories)) return emptyStore();
    if (!Array.isArray(data.products)) data.products = [];
    if (!Array.isArray(data.dependencies)) data.dependencies = [];
    return data;
  } catch {
    return emptyStore();
  }
}

export async function writeStore(data: StoreData): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}
