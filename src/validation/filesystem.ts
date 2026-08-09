import { fileURLToPath } from "node:url";
import nodePath from "node:path";
import { classifyExistingPaths } from "./existence.js";
import { removeContainedMatches } from "./containment.js";
import { filterSearchablePaths } from "../search/policy.js";
import { expandVariables } from "../variables.js";
import { resolveUncPath } from "../native/unc.js";
import { settings } from "../../config/settings.js";
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
type PreparedCandidate = Pick<ResolvedCandidate, "location" | "position"> & { value: string };
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
function parseLocationPart(value: string, name: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${name} must be a safe integer`);
  }
  return result;
}
function prepareCandidate(candidate: Candidate): PreparedCandidate {
  let end = candidate.end;
  let start = candidate.start;
  let value = candidate.value;
  if (candidate.kind !== "inventory" && candidate.kind !== "quoted") {
    const startTrimmed = value.trimStart();
    start += value.length - startTrimmed.length;
    value = startTrimmed;
    const endTrimmed = value.trimEnd();
    end -= value.length - endTrimmed.length;
    value = endTrimmed;
    if (
      value.length >= 2 &&
      ((value[0] === '"' && value.at(-1) === '"') ||
        (value[0] === "'" && value.at(-1) === "'") ||
        (value[0] === "`" && value.at(-1) === "`"))
    ) {
      start += 1;
      end -= 1;
      value = value.slice(1, -1);
    }
    while (value.length > 0 && settings.trailingPunctuation.includes(value.at(-1) ?? "")) {
      end -= 1;
      value = value.slice(0, -1);
    }
  }
  if (candidate.kind === "inventory") {
    return { position: { end, start }, value };
  }
  const match = settings.locationSuffixPattern.exec(value);
  if (match === null) {
    return { position: { end, start }, value };
  }
  const lineValue = match.groups?.line;
  if (lineValue === undefined) {
    throw new TypeError("locationSuffixPattern must capture a line");
  }
  const columnValue = match.groups?.column;
  const location: PathLocation =
    columnValue === undefined
      ? { line: parseLocationPart(lineValue, "line") }
      : {
          column: parseLocationPart(columnValue, "column"),
          line: parseLocationPart(lineValue, "line"),
        };
  end -= match[0].length;
  return {
    location,
    position: { end, start },
    value: value.slice(0, match.index),
  };
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
