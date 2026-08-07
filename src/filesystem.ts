import { fileURLToPath } from "node:url";
import { stat } from "node:fs/promises";
import nodePath from "node:path";
import pLimit from "p-limit";
import type { Candidate } from "./types.js";
import { settings } from "./config.js";

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
function expandEnvironment(value: string): string {
  return value.replace(environmentPattern, (match, percentName, dollarName) => {
    const name = percentName ?? dollarName;
    const replacement = process.env[name];
    return replacement === undefined ? match : replacement;
  });
}
function unescape(value: string): string {
  if (value.startsWith("\\\\") && !value.startsWith("\\\\\\\\")) {
    return value;
  }
  return value.replace(/\\(["'`\\])/gu, "$1").replace(/\\\\/gu, "\\");
}
function toFilePath(value: string, cwd: string, preserveSyntax = false): string | undefined {
  let expanded = expandEnvironment(trimCandidate(value, preserveSyntax));
  if (expanded.startsWith("file://")) {
    try {
      expanded = fileURLToPath(expanded);
    } catch (error) {
      if (error instanceof TypeError) {
        return undefined;
      }
      throw error;
    }
  } else {
    expanded = unescape(expanded);
    if (expanded === "~" || /^~[\\/]/u.test(expanded)) {
      expanded = nodePath.join(
        process.env.HOME ?? process.env.USERPROFILE ?? "",
        expanded.slice(2),
      );
    }
  }
  if (expanded.length === 0) {
    return undefined;
  }
  return nodePath.normalize(
    nodePath.isAbsolute(expanded) ? expanded : nodePath.resolve(cwd, expanded),
  );
}
async function isExistingFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
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
export async function validateCandidates(candidates: Candidate[], cwd: string): Promise<string[]> {
  const limit = pLimit(settings.validationConcurrency);
  const indexedPaths = new Map<string, number>();
  for (const [index, candidate] of candidates.entries()) {
    const filePath = toFilePath(
      candidate.value,
      cwd,
      candidate.kind === "inventory" || candidate.kind === "quoted",
    );
    const previousIndex = filePath === undefined ? undefined : indexedPaths.get(filePath);
    if (filePath !== undefined && (previousIndex === undefined || index < previousIndex)) {
      indexedPaths.set(filePath, index);
    }
  }
  const found: [string, number][] = [];
  await Promise.all(
    [...indexedPaths].map(([filePath, index]) =>
      limit(async () => {
        if (await isExistingFile(filePath)) {
          found.push([filePath, index]);
        }
      }),
    ),
  );
  return found.toSorted((left, right) => left[1] - right[1]).map(([filePath]) => filePath);
}
export { isExistingFile, toFilePath };
