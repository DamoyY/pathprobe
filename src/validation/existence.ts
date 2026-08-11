import { readdir, stat } from "node:fs/promises";
import nodePath from "node:path";
import pLimit from "p-limit";
import { settings } from "../../config/settings.js";
import type { PathKind } from "../types.js";

const unavailablePathErrors = new Set([
    "EACCES",
    "ELOOP",
    "ENAMETOOLONG",
    "ENOTDIR",
    "ENOENT",
    "EPERM",
    "EINVAL",
  ]),
  unverifiableUncErrors = new Set(["UNKNOWN", "EUNKNOWN"]);
function pathKey(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}
function isUnavailablePathError(error: unknown, filePath?: string): boolean {
  const code =
    error instanceof Error && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;
  return (
    code !== undefined &&
    (unavailablePathErrors.has(code) ||
      (filePath?.startsWith(String.raw`\\`) === true && unverifiableUncErrors.has(code)))
  );
}
async function classifyPath(filePath: string): Promise<PathKind | undefined> {
  try {
    const pathStats = await stat(filePath);
    if (pathStats.isFile()) {
      return "file";
    }
    return pathStats.isDirectory() ? "directory" : undefined;
  } catch (error) {
    if (isUnavailablePathError(error, filePath)) {
      return undefined;
    }
    throw error;
  }
}
async function classifyAndAdd(found: Map<string, PathKind>, filePath: string): Promise<void> {
  const kind = await classifyPath(filePath);
  if (kind !== undefined) {
    found.set(filePath, kind);
  }
}
export async function classifyExistingPaths(
  paths: readonly string[],
  roots: readonly string[],
): Promise<Map<string, PathKind>> {
  const found = new Map<string, PathKind>(),
    limit = pLimit(settings.validationConcurrency);
  if (paths.length < settings.batchValidationThreshold) {
    await limit.map(paths, (filePath) => classifyAndAdd(found, filePath));
    return found;
  }
  const rootKeys = new Set(roots.map(pathKey)),
    pathsByParent = new Map<string, { parent: string; paths: string[] }>();
  for (const filePath of paths) {
    if (rootKeys.has(pathKey(filePath))) {
      found.set(filePath, "directory");
      continue;
    }
    const parent = nodePath.dirname(filePath),
      key = pathKey(parent),
      group = pathsByParent.get(key) ?? { parent, paths: [] };
    group.paths.push(filePath);
    pathsByParent.set(key, group);
  }
  const directPaths: string[] = [],
    scannedGroups: { parent: string; paths: string[] }[] = [];
  for (const group of pathsByParent.values()) {
    if (group.paths.length < settings.directoryScanThreshold) {
      directPaths.push(...group.paths);
    } else {
      scannedGroups.push(group);
    }
  }
  await Promise.all([
    limit.map(directPaths, (filePath) => classifyAndAdd(found, filePath)),
    limit.map(scannedGroups, async ({ parent, paths: groupPaths }) => {
      let entries;
      try {
        entries = await readdir(parent, { withFileTypes: true });
      } catch (error) {
        if (isUnavailablePathError(error, parent)) {
          return;
        }
        throw error;
      }
      const entriesByName = new Map(entries.map((entry) => [pathKey(entry.name), entry]));
      await Promise.all(
        groupPaths.map(async (filePath) => {
          const name = nodePath.basename(filePath),
            entry = entriesByName.get(pathKey(name));
          if (entry?.isFile()) {
            found.set(filePath, "file");
          } else if (entry?.isDirectory()) {
            found.set(filePath, "directory");
          } else if (entry !== undefined || (process.platform === "win32" && name.includes(":"))) {
            await classifyAndAdd(found, filePath);
          }
        }),
      );
    }),
  ]);
  return found;
}
