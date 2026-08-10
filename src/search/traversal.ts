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
function createReadDirectory(
  root: string,
  searchHidden: boolean,
  readDirectory: ReadDirectory,
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
        completeDirectoryRead(error, entries, optionsOrCallback);
      });
      return;
    }
    if (entryCallback === undefined) {
      throw new TypeError("A directory entry callback is required");
    }
    readDirectory(filePath, optionsOrCallback, (error, entries) => {
      if (error !== null || searchHidden) {
        completeDirectoryRead(error, entries, entryCallback);
        return;
      }
      try {
        const visibleEntries = entries.filter(
          (entry) =>
            !entry.isDirectory() ||
            !hiddenDetector.isHidden(nodePath.join(filePath, entry.name), root),
        );
        entryCallback(null, visibleEntries);
      } catch (caught) {
        entryCallback(caught instanceof Error ? caught : new Error(String(caught)), []);
      }
    });
  }
  return traverseReadDirectory;
}
export function createTraversalFileSystem(
  root: string,
  searchHidden: boolean,
  readDirectory: ReadDirectory = nodeFileSystem.readdir,
) {
  return {
    ...nodeFileSystem,
    readdir: createReadDirectory(root, searchHidden, readDirectory),
  };
}
