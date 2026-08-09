import nodePath from "node:path";
import { AhoCorasick } from "@monyone/aho-corasick";
import { listSearchEntries } from "./policy.js";
import type {
  Candidate,
  InventoryMatcher,
  InventoryPattern,
  RootPrefix,
  SearchEntry,
} from "../types.js";

let inventoryMatcherCache: InventoryMatcher | undefined;
function isBoundary(
  value: string | undefined,
  following: string | undefined,
  directoryEnd = false,
): boolean {
  if (directoryEnd && value !== ".") {
    return value === undefined || /[\s"'`<>)\]},;:!?，。；：！？、]/u.test(value);
  }
  if (value === ".") {
    return following === undefined || !/[\p{L}\p{N}_-]/u.test(following);
  }
  return value === undefined || !/[\p{L}\p{N}_/\\-]/u.test(value);
}
function addMatch(
  result: Candidate[],
  seen: Set<string>,
  text: string,
  value: string,
  start: number,
  end: number,
  expectedKind: InventoryPattern["expectedKind"],
): void {
  if (
    !isBoundary(text[start - 1], text[start]) ||
    !isBoundary(text[end], text[end + 1], expectedKind === "directory")
  ) {
    return;
  }
  const key = `${start}:${end}:${text.slice(start, end)}`;
  if (!seen.has(key)) {
    seen.add(key);
    result.push({ end, expectedKind, kind: "inventory", start, value });
  }
}
function addVariant(
  patterns: Map<string, InventoryPattern>,
  entry: SearchEntry,
  value: string,
): void {
  const key = process.platform === "win32" ? value.toLowerCase() : value;
  if (!patterns.has(key)) {
    patterns.set(key, {
      expectedKind: entry.directory ? "directory" : "file",
      relative: entry.path,
      value,
    });
  }
}
function addEntryVariants(patterns: Map<string, InventoryPattern>, entry: SearchEntry): void {
  const native = entry.path.replaceAll("/", nodePath.sep);
  if (entry.directory) {
    addVariant(patterns, entry, `${entry.path}/`);
    addVariant(patterns, entry, `${native}${nodePath.sep}`);
    return;
  }
  addVariant(patterns, entry, entry.path);
  addVariant(patterns, entry, native);
}
function createRootPrefixes(roots: readonly string[]): RootPrefix[] {
  const prefixes = new Map<string, RootPrefix>();
  for (const root of roots) {
    const native = root.endsWith(nodePath.sep) ? root : `${root}${nodePath.sep}`;
    const slashRoot = root.replaceAll(nodePath.sep, "/");
    const slash = slashRoot.endsWith("/") ? slashRoot : `${slashRoot}/`;
    for (const value of [native, slash]) {
      const key = process.platform === "win32" ? value.toLowerCase() : value;
      prefixes.set(key, { root, value: key });
    }
  }
  return [...prefixes.values()];
}
function addAbsoluteMatch(
  result: Candidate[],
  seen: Set<string>,
  source: string,
  text: string,
  pattern: InventoryPattern,
  prefixes: readonly RootPrefix[],
  end: number,
  relativeStart: number,
): boolean {
  for (const prefix of prefixes) {
    const start = relativeStart - prefix.value.length;
    if (start >= 0 && source.startsWith(prefix.value, start)) {
      addMatch(
        result,
        seen,
        text,
        nodePath.resolve(prefix.root, pattern.relative),
        start,
        end,
        pattern.expectedKind,
      );
      return true;
    }
  }
  return false;
}
function hasSameEntries(
  cached: InventoryMatcher,
  entries: readonly (readonly SearchEntry[])[],
): boolean {
  if (cached.entries.length !== entries.length) {
    return false;
  }
  for (let index = 0; index < entries.length; index += 1) {
    const cachedEntries = cached.entries[index];
    const currentEntries = entries[index];
    if (cachedEntries === undefined || currentEntries === undefined) {
      return false;
    }
    if (cachedEntries.length !== currentEntries.length) {
      return false;
    }
    for (let entryIndex = 0; entryIndex < currentEntries.length; entryIndex += 1) {
      const cachedEntry = cachedEntries[entryIndex];
      const currentEntry = currentEntries[entryIndex];
      if (
        cachedEntry === undefined ||
        currentEntry === undefined ||
        cachedEntry.directory !== currentEntry.directory ||
        cachedEntry.path !== currentEntry.path
      ) {
        return false;
      }
    }
  }
  return true;
}
function canReuseMatcher(
  cached: InventoryMatcher | undefined,
  entries: readonly (readonly SearchEntry[])[],
  roots: readonly string[],
  respectIgnore: boolean,
  searchHidden: boolean,
): cached is InventoryMatcher {
  return (
    cached !== undefined &&
    cached.respectIgnore === respectIgnore &&
    cached.searchHidden === searchHidden &&
    cached.roots.length === roots.length &&
    cached.roots.every((root, index) => root === roots[index]) &&
    hasSameEntries(cached, entries)
  );
}
export async function inventoryCandidates(
  text: string,
  roots: readonly string[],
  respectIgnore: boolean,
  searchHidden: boolean,
): Promise<Candidate[]> {
  const entries = await Promise.all(
    roots.map((root) => listSearchEntries(root, respectIgnore, searchHidden)),
  );
  const result: Candidate[] = [];
  const seen = new Set<string>();
  const source = process.platform === "win32" ? text.toLowerCase() : text;
  let inventoryMatcher = inventoryMatcherCache;
  if (!canReuseMatcher(inventoryMatcher, entries, roots, respectIgnore, searchHidden)) {
    const patterns = new Map<string, InventoryPattern>();
    for (const relativeEntries of entries) {
      for (const entry of relativeEntries) {
        addEntryVariants(patterns, entry);
      }
    }
    inventoryMatcher = {
      entries,
      matcher: new AhoCorasick([...patterns.keys()]),
      patterns,
      prefixes: createRootPrefixes(roots),
      respectIgnore,
      roots: [...roots],
      searchHidden,
    };
    inventoryMatcherCache = inventoryMatcher;
  }
  for (const { begin, end, keyword } of inventoryMatcher.matcher.matchInText(source)) {
    const pattern = inventoryMatcher.patterns.get(keyword);
    if (pattern === undefined) {
      throw new Error("Inventory matcher returned an unknown path");
    }
    if (
      !addAbsoluteMatch(result, seen, source, text, pattern, inventoryMatcher.prefixes, end, begin)
    ) {
      addMatch(result, seen, text, pattern.value, begin, end, pattern.expectedKind);
    }
  }
  return result;
}
