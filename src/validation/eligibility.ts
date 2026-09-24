import { filterSearchablePaths } from "../search/policy.js";
import { pathKey } from "../search/path-identity.js";
import type { PathKind } from "../types.js";
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
    ),
    searchableKeys = new Set([...searchablePaths].map(pathKey));
  return new Map([...existingPaths].filter(([filePath]) => searchableKeys.has(pathKey(filePath))));
}
