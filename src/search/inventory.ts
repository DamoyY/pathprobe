import nodePath from "node:path";
import { AhoCorasick } from "@monyone/aho-corasick";
import { addAbsoluteMatch } from "./absolute-match.js";
import { listInventoryEntries } from "./inventory-cache.js";
import { normalizeSource, originalOffset } from "./normalization.js";
import { pathKey } from "./path-identity.js";
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
  const key = pathKey(value);
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
    const native = root.endsWith(nodePath.sep) ? root : `${root}${nodePath.sep}`,
      slashRoot = root.replaceAll(nodePath.sep, "/"),
      slash = slashRoot.endsWith("/") ? slashRoot : `${slashRoot}/`;
    for (const value of [native, slash]) {
      const key = pathKey(value);
      prefixes.set(key, { root, value: key });
    }
  }
  return [...prefixes.values()];
}
function hasSameEntries(
  cached: InventoryMatcher,
  entries: readonly (readonly SearchEntry[])[],
): boolean {
  if (cached.entries === entries) {
    return true;
  }
  if (cached.entries.length !== entries.length) {
    return false;
  }
  for (let index = 0; index < entries.length; index += 1) {
    const cachedEntries = cached.entries[index],
      currentEntries = entries[index];
    if (cachedEntries === undefined || currentEntries === undefined) {
      return false;
    }
    if (cachedEntries === currentEntries) {
      continue;
    }
    if (cachedEntries.length !== currentEntries.length) {
      return false;
    }
    for (let entryIndex = 0; entryIndex < currentEntries.length; entryIndex += 1) {
      const cachedEntry = cachedEntries[entryIndex],
        currentEntry = currentEntries[entryIndex];
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
    cached?.respectIgnore === respectIgnore &&
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
      roots.map((root) => listInventoryEntries(root, respectIgnore, searchHidden)),
    ),
    result: Candidate[] = [],
    seen = new Set<string>(),
    sourceMap = normalizeSource(text),
    source = sourceMap.value;
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
      !addAbsoluteMatch(
        source,
        pattern,
        inventoryMatcher.prefixes,
        sourceMap,
        end,
        begin,
        (value, start, originalEnd, expectedKind) =>
          addMatch(result, seen, text, value, start, originalEnd, expectedKind),
      )
    ) {
      const start = originalOffset(sourceMap, begin),
        originalEnd = originalOffset(sourceMap, end);
      if (start !== undefined && originalEnd !== undefined) {
        addMatch(result, seen, text, pattern.value, start, originalEnd, pattern.expectedKind);
      }
    }
  }
  return result;
}
