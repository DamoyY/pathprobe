import fastGlob from "fast-glob";
import nodePath from "node:path";
import type { Candidate } from "./types.js";

function isBoundary(value: string | undefined): boolean {
  return value === undefined || !/[\p{L}\p{N}_./\\-]/u.test(value);
}
function addOccurrences(result: Candidate[], seen: Set<string>, text: string, value: string): void {
  const source = process.platform === "win32" ? text.toLowerCase() : text;
  const target = process.platform === "win32" ? value.toLowerCase() : value;
  let offset = source.indexOf(target);
  while (offset !== -1) {
    const end = offset + target.length;
    if (isBoundary(text[offset - 1]) && isBoundary(text[end])) {
      const key = `${offset}:${end}:${text.slice(offset, end)}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          end,
          kind: "inventory",
          start: offset,
          value: text.slice(offset, end),
        });
      }
    }
    offset = source.indexOf(target, offset + 1);
  }
}
export async function inventoryCandidates(text: string, cwd: string): Promise<Candidate[]> {
  const files = await fastGlob("**/*", {
    cwd,
    dot: true,
    followSymbolicLinks: false,
    onlyFiles: false,
    unique: true,
  });
  const result: Candidate[] = [];
  const seen = new Set<string>();
  for (const relativeFile of files) {
    addOccurrences(result, seen, text, relativeFile);
    addOccurrences(result, seen, text, relativeFile.replaceAll("/", nodePath.sep));
    const absoluteFile = nodePath.resolve(cwd, relativeFile);
    addOccurrences(result, seen, text, absoluteFile);
    addOccurrences(result, seen, text, absoluteFile.replaceAll(nodePath.sep, "/"));
  }
  return result;
}
