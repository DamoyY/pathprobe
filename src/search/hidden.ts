import nodePath from "node:path";
import { hasWindowsHiddenAttribute } from "../native/attributes.js";

function pathKey(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}
function relativePath(filePath: string, boundary: string): string {
  const relative = nodePath.relative(boundary, filePath);
  if (
    nodePath.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${nodePath.sep}`)
  ) {
    throw new RangeError(`${filePath} is outside the hidden-path boundary ${boundary}`);
  }
  return relative;
}
function hasHiddenDotSegment(filePath: string, boundary: string): boolean {
  return relativePath(filePath, boundary)
    .split(/[\\/]/u)
    .some((part) => part.length > 1 && part.startsWith("."));
}
export function createHiddenPathDetector() {
  const attributeCache = new Map<string, boolean>();
  return {
    isHidden(filePath: string, boundary: string): boolean {
      if (process.platform !== "win32") {
        return hasHiddenDotSegment(filePath, boundary);
      }
      relativePath(filePath, boundary);
      const boundaryKey = pathKey(nodePath.resolve(boundary));
      let current = nodePath.resolve(filePath);
      while (pathKey(current) !== boundaryKey) {
        const key = pathKey(current);
        let hidden = attributeCache.get(key);
        if (hidden === undefined) {
          hidden = hasWindowsHiddenAttribute(current);
          attributeCache.set(key, hidden);
        }
        if (hidden) {
          return true;
        }
        const parent = nodePath.dirname(current);
        if (parent === current) {
          throw new Error(`Unable to reach hidden-path boundary ${boundary} from ${filePath}`);
        }
        current = parent;
      }
      return false;
    },
  };
}
