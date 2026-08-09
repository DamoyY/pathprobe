import nodePath from "node:path";
import { AhoCorasick } from "@monyone/aho-corasick";
import { listSearchEntries } from "./policy.js";
import type { Candidate } from "./types.js";

interface InventoryPattern {
  relative: string;
  value: string;
}
interface RootPrefix {
  root: string;
  value: string;
}
interface InventoryMatcher {
  entries: readonly (readonly string[])[];
  matcher: AhoCorasick;
  patterns: Map<string, InventoryPattern>;
  prefixes: readonly RootPrefix[];
  respectIgnore: boolean;
  roots: readonly string[];
  searchHidden: boolean;
}
let inventoryMatcherCache: InventoryMatcher | undefined;
function isBoundary(value: string | undefined, following: string | undefined): boolean {
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
): void {
  if (!isBoundary(text[start - 1], text[start]) || !isBoundary(text[end], text[end + 1])) {
    return;
  }
  const key = `${start}:${end}:${text.slice(start, end)}`;
  if (!seen.has(key)) {
    seen.add(key);
    result.push({ end, kind: "inventory", start, value });
  }
}
function addVariant(
  patterns: Map<string, InventoryPattern>,
  relative: string,
  value: string,
): void {
  const key = process.platform === "win32" ? value.toLowerCase() : value;
  if (!patterns.has(key)) {
    patterns.set(key, { relative, value });
  }
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
      addMatch(result, seen, text, nodePath.resolve(prefix.root, pattern.relative), start, end);
      return true;
    }
  }
  return false;
}
function hasSameEntries(
  cached: InventoryMatcher,
  entries: readonly (readonly string[])[],
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
      if (cachedEntries[entryIndex] !== currentEntries[entryIndex]) {
        return false;
      }
    }
  }
  return true;
}
function canReuseMatcher(
  cached: InventoryMatcher | undefined,
  entries: readonly (readonly string[])[],
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
      for (const relativeEntry of relativeEntries) {
        addVariant(patterns, relativeEntry, relativeEntry);
        addVariant(patterns, relativeEntry, relativeEntry.replaceAll("/", nodePath.sep));
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
      addMatch(result, seen, text, pattern.value, begin, end);
    }
  }
  return result;
}
