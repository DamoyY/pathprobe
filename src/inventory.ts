import nodePath from "node:path";
import { listSearchEntries } from "./policy.js";
import type { Candidate } from "./types.js";

function isBoundary(value: string | undefined, following: string | undefined): boolean {
  if (value === ".") {
    return following === undefined || !/[\p{L}\p{N}_-]/u.test(following);
  }
  return value === undefined || !/[\p{L}\p{N}_/\\-]/u.test(value);
}
function addOccurrences(
  result: Candidate[],
  seen: Set<string>,
  source: string,
  text: string,
  value: string,
): void {
  const target = process.platform === "win32" ? value.toLowerCase() : value;
  let offset = source.indexOf(target);
  while (offset !== -1) {
    const end = offset + target.length;
    if (isBoundary(text[offset - 1], text[offset]) && isBoundary(text[end], text[end + 1])) {
      const key = `${offset}:${end}:${text.slice(offset, end)}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          end,
          kind: "inventory",
          start: offset,
          value,
        });
      }
    }
    offset = source.indexOf(target, offset + 1);
  }
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
  const scanned = new Set<string>();
  const source = process.platform === "win32" ? text.toLowerCase() : text;
  for (const [rootIndex, relativeEntries] of entries.entries()) {
    const root = roots[rootIndex];
    if (root === undefined) {
      continue;
    }
    for (const relativeEntry of relativeEntries) {
      const absoluteEntry = nodePath.resolve(root, relativeEntry);
      const variants = [
        relativeEntry,
        relativeEntry.replaceAll("/", nodePath.sep),
        absoluteEntry,
        absoluteEntry.replaceAll(nodePath.sep, "/"),
      ];
      for (const value of variants) {
        const key = process.platform === "win32" ? value.toLowerCase() : value;
        if (!scanned.has(key)) {
          scanned.add(key);
          addOccurrences(result, seen, source, text, value);
        }
      }
    }
  }
  return result;
}
