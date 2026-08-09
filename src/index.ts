import { extractCandidates } from "./candidates.js";
import { validateCandidates } from "./validation/filesystem.js";
import { inventoryCandidates } from "./search/inventory.js";
import { resolveSearchDirectories } from "./search/policy.js";
import { settings } from "../config/settings.js";
import type { FindExistingPathsOptions, PathMatch, Variables } from "./types.js";

export const MAX_LEVEL = settings.spanWordLimits.length + 3;
function validateOptions(value: unknown): asserts value is FindExistingPathsOptions {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("options must be an object");
  }
}
function validateVariables(value: unknown): asserts value is Variables {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.values(value).some((item) => typeof item !== "string")
  ) {
    throw new TypeError("variables must be an object of string values");
  }
}
export async function findExistingPaths(options: FindExistingPathsOptions): Promise<PathMatch[]> {
  validateOptions(options);
  const {
    directories,
    level,
    respectIgnore = settings.respectIgnoreByDefault,
    searchHidden = settings.searchHiddenByDefault,
    text,
    variables = {},
  } = options;
  if (typeof text !== "string") {
    throw new TypeError("text must be a string");
  }
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
    throw new RangeError(`level must be an integer from 1 to ${MAX_LEVEL}`);
  }
  validateVariables(variables);
  if (typeof respectIgnore !== "boolean") {
    throw new TypeError("respectIgnore must be a boolean");
  }
  if (typeof searchHidden !== "boolean") {
    throw new TypeError("searchHidden must be a boolean");
  }
  const roots = await resolveSearchDirectories(directories);
  const candidates = extractCandidates(text, level);
  if (level === MAX_LEVEL) {
    candidates.push(...(await inventoryCandidates(text, roots, respectIgnore, searchHidden)));
  }
  return validateCandidates(candidates, roots, variables, respectIgnore, searchHidden);
}
export type {
  FindExistingPathsOptions,
  PathKind,
  PathLocation,
  PathMatch,
  PathPosition,
  SearchLevel,
  Variables,
} from "./types.js";
