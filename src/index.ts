import nodePath from "node:path";
import { stat } from "node:fs/promises";
import { extractCandidates } from "./candidates.js";
import { settings } from "./config.js";
import { validateCandidates } from "./filesystem.js";
import { inventoryCandidates } from "./inventory.js";
import type { SearchLevel } from "./types.js";

export const MAX_LEVEL = settings.spanWordLimits.length + 3;
export async function findExistingFilePaths(
  text: string,
  level: SearchLevel,
  cwd: string = process.cwd(),
): Promise<string[]> {
  if (typeof text !== "string") {
    throw new TypeError("text must be a string");
  }
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new RangeError(`level must be an integer from 1 to ${MAX_LEVEL}`);
  }
  if (typeof cwd !== "string") {
    throw new TypeError("cwd must be a string");
  }
  const resolvedCwd = nodePath.resolve(cwd);
  const cwdStats = await stat(resolvedCwd);
  if (!cwdStats.isDirectory()) {
    throw new TypeError("cwd must resolve to a directory");
  }
  const candidates = extractCandidates(text, level);
  if (level === MAX_LEVEL) {
    candidates.push(...(await inventoryCandidates(text, resolvedCwd)));
  }
  return validateCandidates(candidates, resolvedCwd);
}
export type { SearchLevel };
