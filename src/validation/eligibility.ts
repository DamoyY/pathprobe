import { filterSearchablePaths } from "../search/policy.js";
import type { PathKind } from "../types.js";

function pathKey(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}
export async function applySearchPolicies(
  existingPaths: ReadonlyMap<string, PathKind>,
  roots: readonly string[],
  respectIgnore: boolean,
  searchHidden: boolean,
): Promise<Map<string, PathKind>> {
  if (!respectIgnore && searchHidden) {
    return new Map(existingPaths);
  }
  const searchablePaths = await filterSearchablePaths(
    [...existingPaths.keys()],
    roots,
    respectIgnore,
    searchHidden,
  );
  const searchableKeys = new Set([...searchablePaths].map(pathKey));
  return new Map([...existingPaths].filter(([filePath]) => searchableKeys.has(pathKey(filePath))));
}
