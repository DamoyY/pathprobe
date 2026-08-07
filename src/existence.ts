import { readdir, stat } from "node:fs/promises";
import nodePath from "node:path";
import pLimit from "p-limit";
import { settings } from "../config/settings.js";

const knownFileErrors = new Set([
  "EACCES",
  "ELOOP",
  "ENAMETOOLONG",
  "ENOTDIR",
  "ENOENT",
  "EPERM",
  "EINVAL",
]);
type IndexedPath = [filePath: string, candidateIndex: number];
function pathKey(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}
function isKnownFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    knownFileErrors.has(error.code)
  );
}
async function isExistingPath(filePath: string): Promise<boolean> {
  try {
    const pathStats = await stat(filePath);
    return pathStats.isFile() || pathStats.isDirectory();
  } catch (error) {
    if (isKnownFileError(error)) {
      return false;
    }
    throw error;
  }
}
export async function locateExistingPaths(
  indexedPaths: readonly IndexedPath[],
  roots: readonly string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  const limit = pLimit(settings.validationConcurrency);
  if (indexedPaths.length < settings.batchValidationThreshold) {
    await Promise.all(
      indexedPaths.map(([filePath]) =>
        limit(async () => {
          if (await isExistingPath(filePath)) {
            found.add(filePath);
          }
        }),
      ),
    );
    return found;
  }
  const rootKeys = new Set(roots.map(pathKey));
  const pathsByParent = new Map<string, { parent: string; paths: IndexedPath[] }>();
  for (const indexedPath of indexedPaths) {
    const filePath = indexedPath[0];
    if (rootKeys.has(pathKey(filePath))) {
      found.add(filePath);
      continue;
    }
    const parent = nodePath.dirname(filePath);
    const key = pathKey(parent);
    const group = pathsByParent.get(key) ?? { parent, paths: [] };
    group.paths.push(indexedPath);
    pathsByParent.set(key, group);
  }
  const directPaths: IndexedPath[] = [];
  const scannedGroups: { parent: string; paths: IndexedPath[] }[] = [];
  for (const group of pathsByParent.values()) {
    if (group.paths.length < settings.directoryScanThreshold) {
      directPaths.push(...group.paths);
    } else {
      scannedGroups.push(group);
    }
  }
  await Promise.all([
    ...directPaths.map(([filePath]) =>
      limit(async () => {
        if (await isExistingPath(filePath)) {
          found.add(filePath);
        }
      }),
    ),
    ...scannedGroups.map(({ parent, paths }) =>
      limit(async () => {
        let entries;
        try {
          entries = await readdir(parent, { withFileTypes: true });
        } catch (error) {
          if (isKnownFileError(error)) {
            return;
          }
          throw error;
        }
        const entriesByName = new Map(entries.map((entry) => [pathKey(entry.name), entry]));
        await Promise.all(
          paths.map(async ([filePath]) => {
            const name = nodePath.basename(filePath);
            const entry = entriesByName.get(pathKey(name));
            if (entry?.isFile() || entry?.isDirectory()) {
              found.add(filePath);
            } else if (
              entry !== undefined ||
              (process.platform === "win32" && name.includes(":"))
            ) {
              if (await isExistingPath(filePath)) {
                found.add(filePath);
              }
            }
          }),
        );
      }),
    ),
  ]);
  return found;
}
