import nodeFileSystem from "node:fs";
import nodePath from "node:path";
import type { Options as GlobbyOptions } from "globby";
import { createHiddenPathDetector } from "./hidden.js";

type ReadDirectory = NonNullable<NonNullable<GlobbyOptions["fs"]>["readdir"]>;
const unreadableDirectoryErrors = new Set(["EACCES", "ENOTDIR", "ENOENT", "EPERM"]);
interface DirectoryEntry {
  isBlockDevice(): boolean;
  isCharacterDevice(): boolean;
  isDirectory(): boolean;
  isFIFO(): boolean;
  isFile(): boolean;
  isSocket(): boolean;
  isSymbolicLink(): boolean;
  name: string;
}
type DirectoryEntryCallback = (
  error: NodeJS.ErrnoException | null,
  entries: DirectoryEntry[],
) => void;
type DirectoryNameCallback = (error: NodeJS.ErrnoException | null, entries: string[]) => void;
interface TraversalScope {
  paths: readonly string[];
  passthroughNames: readonly string[];
}
interface TraversalFileSystemOptions {
  readDirectory?: ReadDirectory;
  scope?: TraversalScope;
}
interface IndexedScope {
  childrenByDirectory: ReadonlyMap<string, ReadonlySet<string>>;
  passthroughNames: ReadonlySet<string>;
}
function pathKey(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}
function isUnreadableDirectoryError(error: NodeJS.ErrnoException): boolean {
  return error.code !== undefined && unreadableDirectoryErrors.has(error.code);
}
function completeDirectoryRead<T>(
  error: NodeJS.ErrnoException | null,
  entries: T[],
  callback: (error: NodeJS.ErrnoException | null, entries: T[]) => void,
): void {
  if (error === null) {
    callback(null, entries);
  } else if (isUnreadableDirectoryError(error)) {
    callback(null, []);
  } else {
    callback(error, []);
  }
}
function indexScope(root: string, scope: TraversalScope | undefined): IndexedScope | undefined {
  if (scope === undefined) {
    return undefined;
  }
  const resolvedRoot = nodePath.resolve(root),
    childrenByDirectory = new Map<string, Set<string>>();
  for (const relativePath of scope.paths) {
    if (
      nodePath.isAbsolute(relativePath) ||
      relativePath === ".." ||
      relativePath.startsWith(`..${nodePath.sep}`)
    ) {
      throw new RangeError(`${relativePath} is outside the traversal root ${root}`);
    }
    let directory = resolvedRoot;
    for (const name of relativePath.split(nodePath.sep)) {
      const directoryKey = pathKey(directory),
        children = childrenByDirectory.get(directoryKey) ?? new Set<string>();
      children.add(pathKey(name));
      childrenByDirectory.set(directoryKey, children);
      directory = nodePath.join(directory, name);
    }
  }
  return {
    childrenByDirectory,
    passthroughNames: new Set(scope.passthroughNames.map(pathKey)),
  };
}
function filterToScope<T extends DirectoryEntry | string>(
  filePath: string,
  entries: T[],
  scope: IndexedScope | undefined,
): T[] {
  if (scope === undefined) {
    return entries;
  }
  const children = scope.childrenByDirectory.get(pathKey(nodePath.resolve(filePath)));
  if (children === undefined) {
    return [];
  }
  return entries.filter((entry) => {
    const name = typeof entry === "string" ? entry : entry.name,
      key = pathKey(name);
    return children.has(key) || scope.passthroughNames.has(key);
  });
}
function completeTraversalRead<T extends DirectoryEntry | string>(
  root: string,
  filePath: string,
  searchHidden: boolean,
  hiddenDetector: ReturnType<typeof createHiddenPathDetector>,
  scope: IndexedScope | undefined,
  error: NodeJS.ErrnoException | null,
  entries: T[],
  callback: (error: NodeJS.ErrnoException | null, entries: T[]) => void,
): void {
  const scopedEntries = error === null ? filterToScope(filePath, entries, scope) : entries;
  if (error !== null || searchHidden) {
    completeDirectoryRead(error, scopedEntries, callback);
    return;
  }
  try {
    const visibleEntries = scopedEntries.filter((entry) => {
      if (typeof entry !== "string" && !entry.isDirectory()) {
        return true;
      }
      const name = typeof entry === "string" ? entry : entry.name;
      return !hiddenDetector.isHidden(nodePath.join(filePath, name), root);
    });
    callback(null, visibleEntries);
  } catch (caughtError) {
    callback(caughtError instanceof Error ? caughtError : new Error(String(caughtError)), []);
  }
}
function createReadDirectory(
  root: string,
  searchHidden: boolean,
  readDirectory: ReadDirectory,
  scope: IndexedScope | undefined,
): ReadDirectory {
  const hiddenDetector = createHiddenPathDetector();
  function traverseReadDirectory(
    filePath: string,
    options: { withFileTypes: true },
    callback: DirectoryEntryCallback,
  ): void;
  function traverseReadDirectory(filePath: string, callback: DirectoryNameCallback): void;
  function traverseReadDirectory(
    filePath: string,
    optionsOrCallback: { withFileTypes: true } | DirectoryNameCallback,
    entryCallback?: DirectoryEntryCallback,
  ): void {
    if (typeof optionsOrCallback === "function") {
      readDirectory(filePath, (error, entries) => {
        completeTraversalRead(
          root,
          filePath,
          searchHidden,
          hiddenDetector,
          scope,
          error,
          entries,
          optionsOrCallback,
        );
      });
      return;
    }
    if (entryCallback === undefined) {
      throw new TypeError("A directory entry callback is required");
    }
    readDirectory(filePath, optionsOrCallback, (error, entries) => {
      completeTraversalRead(
        root,
        filePath,
        searchHidden,
        hiddenDetector,
        scope,
        error,
        entries,
        entryCallback,
      );
    });
  }
  return traverseReadDirectory;
}
export function createTraversalFileSystem(
  root: string,
  searchHidden: boolean,
  options: TraversalFileSystemOptions = {},
) {
  const { readDirectory = nodeFileSystem.readdir, scope } = options;
  return {
    ...nodeFileSystem,
    readdir: createReadDirectory(root, searchHidden, readDirectory, indexScope(root, scope)),
  };
}
