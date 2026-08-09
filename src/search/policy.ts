import { stat } from "node:fs/promises";
import nodePath from "node:path";
import fastGlob from "fast-glob";
import { convertPathToPattern, globby } from "globby";
import { settings } from "../../config/settings.js";
import { resolveUncPath } from "../native/unc.js";
import type { SearchEntry } from "../types.js";

function pathKey(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}
function isWithinRoot(filePath: string, root: string): boolean {
  const relative = nodePath.relative(root, filePath);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${nodePath.sep}`) &&
      !nodePath.isAbsolute(relative))
  );
}
function isHidden(relativePath: string): boolean {
  return relativePath.split(/[\\/]/u).some((part) => part.length > 1 && part.startsWith("."));
}
function traversalOptions(root: string, searchHidden: boolean) {
  return {
    caseSensitiveMatch: process.platform !== "win32",
    cwd: root,
    dot: searchHidden,
    followSymbolicLinks: false,
    onlyFiles: false,
    unique: true,
  } as const;
}
function globbyOptions(root: string, respectIgnore: boolean, searchHidden: boolean) {
  return {
    ...traversalOptions(root, searchHidden),
    expandDirectories: false,
    gitignore: respectIgnore,
    globalGitignore: respectIgnore,
    ...(respectIgnore ? { ignoreFiles: settings.ignoreFilePatterns } : {}),
  } as const;
}
export async function resolveSearchDirectories(directories: readonly string[]): Promise<string[]> {
  if (!Array.isArray(directories)) {
    throw new TypeError("directories must be an array");
  }
  if (directories.length === 0) {
    throw new RangeError("directories must not be empty");
  }
  const unique = new Map<string, string>();
  for (const directory of directories) {
    if (typeof directory !== "string" || directory.length === 0) {
      throw new TypeError("every directory must be a non-empty string");
    }
    const resolvedUnc = resolveUncPath(directory);
    if (resolvedUnc === undefined || resolvedUnc.length === 0) {
      throw new TypeError(`${directory} cannot be represented as a drive-based path`);
    }
    const resolved = nodePath.resolve(resolvedUnc);
    unique.set(pathKey(resolved), resolved);
  }
  await Promise.all(
    [...unique.values()].map(async (directory) => {
      if (!(await stat(directory)).isDirectory()) {
        throw new TypeError(`${directory} is not a directory`);
      }
    }),
  );
  return [...unique.values()];
}
export async function listSearchEntries(
  root: string,
  respectIgnore: boolean,
  searchHidden: boolean,
): Promise<SearchEntry[]> {
  const entries = !respectIgnore
    ? await fastGlob("**/*", { ...traversalOptions(root, searchHidden), objectMode: true })
    : await globby("**/*", {
        ...globbyOptions(root, respectIgnore, searchHidden),
        objectMode: true,
      });
  return entries.map((entry) => ({
    directory: entry.dirent.isDirectory(),
    path: entry.path,
  }));
}
export async function filterSearchablePaths(
  paths: readonly string[],
  roots: readonly string[],
  respectIgnore: boolean,
  searchHidden: boolean,
): Promise<Set<string>> {
  const allowed = new Set<string>();
  const pathsByRoot = new Map<string, string[]>();
  for (const filePath of paths) {
    let hasSearchRoot = false;
    for (const root of roots) {
      if (!isWithinRoot(filePath, root)) {
        continue;
      }
      hasSearchRoot = true;
      const relative = nodePath.relative(root, filePath);
      if (!searchHidden && isHidden(relative)) {
        continue;
      }
      if (relative === "" || !respectIgnore) {
        allowed.add(filePath);
      } else {
        const grouped = pathsByRoot.get(root) ?? [];
        grouped.push(relative);
        pathsByRoot.set(root, grouped);
      }
    }
    if (hasSearchRoot) {
      continue;
    }
    const filesystemRelative = nodePath.relative(nodePath.parse(filePath).root, filePath);
    if (searchHidden || !isHidden(filesystemRelative)) {
      allowed.add(filePath);
    }
  }
  await Promise.all(
    [...pathsByRoot].map(async ([root, relativePaths]) => {
      const patterns = relativePaths.map(convertPathToPattern);
      const matches = await globby(patterns, {
        ...globbyOptions(root, true, true),
        absolute: true,
      });
      for (const match of matches) {
        allowed.add(nodePath.normalize(match));
      }
    }),
  );
  return allowed;
}
