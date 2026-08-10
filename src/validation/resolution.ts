import { fileURLToPath } from "node:url";
import nodePath from "node:path";
import { applySearchPolicies } from "./eligibility.js";
import { classifyExistingPaths } from "./existence.js";
import { removeContainedMatches } from "./containment.js";
import { prepareCandidate } from "./preparation.js";
import { expandVariables } from "../variables.js";
import { resolveUncPath } from "../native/unc.js";
import type {
  Candidate,
  PathKind,
  PathLocation,
  PathMatch,
  PathPosition,
  Variables,
} from "../types.js";

interface ResolvedCandidate {
  expectedKind?: PathKind;
  location?: PathLocation;
  path: string;
  position: PathPosition;
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
function unescape(value: string): string {
  if (value.startsWith("\\\\") && !value.startsWith("\\\\\\\\")) {
    return value;
  }
  return value.replace(/\\(["'`\\])/gu, "$1").replace(/\\\\/gu, "\\");
}
function toPaths(value: string, roots: readonly string[], variables: Variables): string[] {
  let expanded = expandVariables(value, variables);
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
  const resolvedPath = resolveUncPath(expanded);
  if (resolvedPath === undefined || resolvedPath.length === 0) {
    return [];
  }
  expanded = resolvedPath;
  if (nodePath.isAbsolute(expanded)) {
    return [nodePath.normalize(expanded)];
  }
  return uniquePaths(roots.map((root) => nodePath.resolve(root, expanded)));
}
function mergeLocation(match: PathMatch, location: PathLocation | undefined): void {
  if (location === undefined) {
    return;
  }
  if (match.location === undefined) {
    match.location = location;
    return;
  }
  if (match.location.line !== location.line || match.location.column !== location.column) {
    throw new Error("Candidates for the same path and position have conflicting locations");
  }
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
    const prepared = prepareCandidate(candidate);
    if (prepared === undefined) {
      continue;
    }
    const paths = toPaths(prepared.value, roots, variables);
    for (const filePath of paths) {
      resolvedCandidates.push({
        ...(candidate.expectedKind === undefined ? {} : { expectedKind: candidate.expectedKind }),
        ...(prepared.location === undefined ? {} : { location: prepared.location }),
        path: filePath,
        position: prepared.position,
      });
      validationPaths.set(pathKey(filePath), filePath);
    }
  }
  const classifiedPaths = await applySearchPolicies(
    await classifyExistingPaths([...validationPaths.values()], roots),
    roots,
    respectIgnore,
    searchHidden,
  );
  const kindsByPath = new Map(
    [...classifiedPaths].map(([filePath, kind]) => [pathKey(filePath), kind]),
  );
  const matches = new Map<string, PathMatch>();
  for (const { expectedKind, location, path, position } of resolvedCandidates) {
    const kind = kindsByPath.get(pathKey(path));
    if (kind === undefined || (expectedKind !== undefined && kind !== expectedKind)) {
      continue;
    }
    const key = `${pathKey(path)}\0${position.start}\0${position.end}`;
    const existing = matches.get(key);
    if (existing !== undefined) {
      mergeLocation(existing, location);
      continue;
    }
    matches.set(key, {
      kind,
      ...(location === undefined ? {} : { location }),
      path,
      position,
    });
  }
  return removeContainedMatches([...matches.values()]);
}
