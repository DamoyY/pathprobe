import { fileURLToPath } from "node:url";
import nodePath from "node:path";
import { classifyExistingPaths } from "./existence.js";
import { filterSearchablePaths } from "./policy.js";
import { expandVariables } from "./variables.js";
import { settings } from "../config/settings.js";
import type { Candidate, PathMatch, Variables } from "./types.js";

interface ResolvedCandidate {
  candidate: Candidate;
  path: string;
}
function pathKey(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}
function uniquePaths(values: Iterable<string>): string[] {
  const paths = new Map<string, string>();
  for (const value of values) {
    paths.set(pathKey(value), value);
  }
  return [...paths.values()];
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
  let expanded = expandVariables(trimCandidate(value, preserveSyntax), variables);
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
    return [nodePath.normalize(expanded)];
  }
  return uniquePaths(roots.map((root) => nodePath.resolve(root, expanded)));
}
export async function validateCandidates(
  candidates: Candidate[],
  roots: readonly string[],
  variables: Variables,
  respectIgnore: boolean,
  searchHidden: boolean,
): Promise<PathMatch[]> {
  const resolvedCandidates: ResolvedCandidate[] = [];
  const validationPaths = new Map<string, string>();
  for (const candidate of candidates) {
    const paths = toPaths(
      candidate.value,
      roots,
      variables,
      candidate.kind === "inventory" || candidate.kind === "quoted",
    );
    for (const filePath of paths) {
      resolvedCandidates.push({ candidate, path: filePath });
      validationPaths.set(pathKey(filePath), filePath);
    }
  }
  let searchablePaths = [...validationPaths.values()];
  if (respectIgnore || !searchHidden) {
    searchablePaths = [
      ...(await filterSearchablePaths(searchablePaths, roots, respectIgnore, searchHidden)),
    ];
  }
  const classifiedPaths = await classifyExistingPaths(searchablePaths, roots);
  const kindsByPath = new Map(
    [...classifiedPaths].map(([filePath, kind]) => [pathKey(filePath), kind]),
  );
  return resolvedCandidates.flatMap(({ candidate, path }) => {
    const kind = kindsByPath.get(pathKey(path));
    return kind === undefined
      ? []
      : [
          {
            kind,
            path,
            position: {
              end: candidate.end,
              start: candidate.start,
            },
          },
        ];
  });
}
