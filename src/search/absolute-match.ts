import nodePath from "node:path";
import { originalOffset, type NormalizedSource } from "./normalization.js";
import type { InventoryPattern, RootPrefix } from "../types.js";

type AddMatch = (
  value: string,
  start: number,
  end: number,
  expectedKind: InventoryPattern["expectedKind"],
) => void;
export function addAbsoluteMatch(
  source: string,
  pattern: InventoryPattern,
  prefixes: readonly RootPrefix[],
  sourceMap: NormalizedSource,
  end: number,
  relativeStart: number,
  addMatch: AddMatch,
): boolean {
  for (const prefix of prefixes) {
    const start = relativeStart - prefix.value.length;
    if (start >= 0 && source.startsWith(prefix.value, start)) {
      const originalStart = originalOffset(sourceMap, start),
        originalEnd = originalOffset(sourceMap, end);
      if (originalStart === undefined || originalEnd === undefined) {
        return true;
      }
      addMatch(
        nodePath.resolve(prefix.root, pattern.relative),
        originalStart,
        originalEnd,
        pattern.expectedKind,
      );
      return true;
    }
  }
  return false;
}
