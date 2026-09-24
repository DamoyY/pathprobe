import { stat } from "node:fs/promises";
import nodePath from "node:path";
import process from "node:process";
import { settings } from "../../config/settings.js";
import type { SearchEntry } from "../types.js";
import { listSearchEntries } from "./policy.js";
import { pathKey } from "./path-identity.js";

interface InventoryEntriesCache {
  directories: ReadonlyMap<string, bigint>;
  entries: SearchEntry[];
}
const inventoryEntriesCache = new Map<string, InventoryEntriesCache>();
const inventoryEntriesInflight = new Map<string, Promise<SearchEntry[]>>();
function cacheKey(root: string, respectIgnore: boolean, searchHidden: boolean): string {
  return `${pathKey(root)}\0${respectIgnore ? "1" : "0"}${searchHidden ? "1" : "0"}`;
}
function canCacheEntries(respectIgnore: boolean, searchHidden: boolean): boolean {
  return !respectIgnore && (searchHidden || process.platform !== "win32");
}
function isDirectoryStateError(error: unknown): boolean {
  const code =
    error instanceof Error && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;
  return code === "EACCES" || code === "ENOENT" || code === "ENOTDIR" || code === "EPERM";
}
async function readDirectoryTimes(paths: readonly string[]): Promise<Map<string, bigint>> {
  const entries = await Promise.all(
    [...new Set(paths)].map(async (filePath) => {
      const directory = await stat(filePath, { bigint: true });
      if (!directory.isDirectory()) {
        throw new TypeError(`${filePath} is no longer a directory`);
      }
      return [filePath, directory.mtimeNs] as const;
    }),
  );
  return new Map(entries);
}
async function cacheEntries(
  root: string,
  respectIgnore: boolean,
  searchHidden: boolean,
  entries: SearchEntry[],
): Promise<InventoryEntriesCache> {
  const directories = await readDirectoryTimes([
    root,
    ...entries.filter(({ directory }) => directory).map(({ path }) => nodePath.resolve(root, path)),
  ]);
  const cached = { directories, entries };
  const key = cacheKey(root, respectIgnore, searchHidden);
  inventoryEntriesCache.delete(key);
  inventoryEntriesCache.set(key, cached);
  while (inventoryEntriesCache.size > settings.inventoryCacheLimit) {
    const oldest = inventoryEntriesCache.keys().next().value;
    if (oldest === undefined) {
      throw new Error("Inventory cache eviction failed");
    }
    inventoryEntriesCache.delete(oldest);
  }
  return cached;
}
async function areEntriesCurrent(cache: InventoryEntriesCache): Promise<boolean> {
  try {
    const current = await readDirectoryTimes([...cache.directories.keys()]);
    return [...cache.directories].every(([directory, mtime]) => current.get(directory) === mtime);
  } catch (error) {
    if (isDirectoryStateError(error)) {
      return false;
    }
    throw error;
  }
}
export async function listInventoryEntries(
  root: string,
  respectIgnore: boolean,
  searchHidden: boolean,
): Promise<SearchEntry[]> {
  if (!canCacheEntries(respectIgnore, searchHidden)) {
    return listSearchEntries(root, respectIgnore, searchHidden);
  }
  const key = cacheKey(root, respectIgnore, searchHidden),
    cached = inventoryEntriesCache.get(key);
  if (cached !== undefined && (await areEntriesCurrent(cached))) {
    inventoryEntriesCache.delete(key);
    inventoryEntriesCache.set(key, cached);
    return cached.entries;
  }
  const inflight = inventoryEntriesInflight.get(key);
  if (inflight !== undefined) {
    return inflight;
  }
  const promise = listSearchEntries(root, respectIgnore, searchHidden).then(
    async (entries) => (await cacheEntries(root, respectIgnore, searchHidden, entries)).entries,
  );
  inventoryEntriesInflight.set(key, promise);
  try {
    return await promise;
  } finally {
    if (inventoryEntriesInflight.get(key) === promise) {
      inventoryEntriesInflight.delete(key);
    }
  }
}
