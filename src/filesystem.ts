import { fileURLToPath } from "node:url";
import { stat } from "node:fs/promises";
import nodePath from "node:path";
import pLimit from "p-limit";
import { filterSearchablePaths, isWithinRoot } from "./policy.js";
import { settings } from "../config/settings.js";
import type { Candidate, Variables } from "./types.js";

const environmentPattern = /%([A-Za-z_][A-Za-z0-9_]*)%|\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/gu;
const knownFileErrors = new Set([
  "EACCES",
  "ELOOP",
  "ENAMETOOLONG",
  "ENOTDIR",
  "ENOENT",
  "EPERM",
  "EINVAL",
]);
function pathKey(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}
function trimCandidate(value: string, preserveSyntax: boolean): string {
  let result = preserveSyntax ? value : value.trim();
  if (
    result.length >= 2 &&
    ((result[0] === '"' && result.at(-1) === '"') ||
      (result[0] === "'" && result.at(-1) === "'") ||
      (result[0] === "`" && result.at(-1) === "`"))
  ) {
    result = result.slice(1, -1);
  }
  if (!preserveSyntax) {
    while (result.length > 0 && settings.trailingPunctuation.includes(result.at(-1) ?? "")) {
      result = result.slice(0, -1);
    }

    result = result.replace(settings.locationSuffixPattern, "");
  }
  return result;
}
function expandEnvironment(value: string, variables: Variables): string {
  return value.replace(environmentPattern, (match, percentName, dollarName) => {
    const name = percentName ?? dollarName;
    const replacement = variables[name] ?? process.env[name];
    return replacement === undefined ? match : replacement;
  });
}
function unescape(value: string): string {
  if (value.startsWith("\\\\") && !value.startsWith("\\\\\\\\")) {
    return value;
  }
  return value.replace(/\\(["'`\\])/gu, "$1").replace(/\\\\/gu, "\\");
}
function toPaths(
  value: string,
  roots: readonly string[],
  variables: Variables,
  preserveSyntax = false,
): string[] {
  let expanded = expandEnvironment(trimCandidate(value, preserveSyntax), variables);
  if (expanded.startsWith("file://")) {
    try {
      expanded = fileURLToPath(expanded);
    } catch (error) {
      if (error instanceof TypeError) {
        return [];
      }
      throw error;
    }
  } else {
    expanded = unescape(expanded);
    if (expanded === "~" || /^~[\\/]/u.test(expanded)) {
      expanded = nodePath.join(
        variables.HOME ??
          variables.USERPROFILE ??
          process.env.HOME ??
          process.env.USERPROFILE ??
          "",
        expanded.slice(2),
      );
    }
  }
  if (expanded.length === 0) {
    return [];
  }
  if (nodePath.isAbsolute(expanded)) {
    const absolute = nodePath.normalize(expanded);
    return roots.some((root) => isWithinRoot(absolute, root)) ? [absolute] : [];
  }
  return roots.map((root) => nodePath.resolve(root, expanded));
}
async function isExistingPath(filePath: string): Promise<boolean> {
  try {
    const pathStats = await stat(filePath);
    return pathStats.isFile() || pathStats.isDirectory();
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      typeof error.code === "string" &&
      knownFileErrors.has(error.code)
    ) {
      return false;
    }
    throw error;
  }
}
export async function validateCandidates(
  candidates: Candidate[],
  roots: readonly string[],
  variables: Variables,
  respectIgnore: boolean,
  searchHidden: boolean,
): Promise<string[]> {
  const limit = pLimit(settings.validationConcurrency);
  const indexedPaths = new Map<string, [string, number]>();
  for (const [index, candidate] of candidates.entries()) {
    const paths = toPaths(
      candidate.value,
      roots,
      variables,
      candidate.kind === "inventory" || candidate.kind === "quoted",
    );
    for (const filePath of paths) {
      const key = pathKey(filePath);
      const previous = indexedPaths.get(key);
      const previousIndex = previous?.[1];
      if (previousIndex === undefined || index < previousIndex) {
        indexedPaths.set(key, [filePath, index]);
      }
    }
  }
  const found: [string, number][] = [];
  await Promise.all(
    [...indexedPaths.values()].map(([filePath, index]) =>
      limit(async () => {
        if (await isExistingPath(filePath)) {
          found.push([filePath, index]);
        }
      }),
    ),
  );
  const allowed = await filterSearchablePaths(
    found.map(([filePath]) => filePath),
    roots,
    respectIgnore,
    searchHidden,
  );
  return found
    .toSorted((left, right) => left[1] - right[1])
    .map(([filePath]) => filePath)
    .filter((filePath) => allowed.has(filePath));
}
