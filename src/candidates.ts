import type { Candidate, SearchLevel } from "./types.js";
import { settings } from "../config/settings.js";
import { variableReferenceSource } from "./variables.js";

const explicitPattern =
    /(?:file:\/\/\/?|[A-Za-z]:[\\/]|\\\\|\/|(?:\.{1,2}|~)[\\/])[^"'`<>()[\]{}\s]+/gu,
  quotedPattern = /(["'`])(?<value>[^"'`\r\n]+)\1/gu,
  tokenPattern = /[^\s]+/gu,
  pathTokenPattern =
    /(?:(?:[\p{L}\p{N}_@%$+~.#[\],-]+[\\/])+(?:[\p{L}\p{N}_@%$+~.#[\],-]+)|[\p{L}\p{N}_@%$+~.#[\],-]+\.[\p{L}\p{N}_@%$-]{1,16})(?::\d+){0,2}/gu,
  unquotedPathCharacterSource = "[^\"'`<>()[\\]{}\\s]",
  variablePathPattern = new RegExp(
    `${variableReferenceSource}(?:[\\\\/]${unquotedPathCharacterSource}+)+`,
    "giu",
  ),
  clausePattern = /[^\r\n!?！？;；。]+/gu,
  pathHintPattern =
    /[\\/]|(?:^|[\s"'`])(?:\.{1,2}|~|%[A-Za-z_][A-Za-z0-9_]*%|\$\{?[A-Za-z_][A-Za-z0-9_]*\}?)(?:[\\/]|$)|\.[\p{L}\p{N}]{1,16}(?::\d+){0,2}(?:$|[\s,.;:!?，。；：！？、])/u,
  variableHintPattern = new RegExp(String.raw`${variableReferenceSource}(?:[\\/]|$)`, "iu");
function add(
  result: Candidate[],
  seen: Set<string>,
  value: string,
  start: number,
  end: number,
  kind: Candidate["kind"],
): void {
  if (value.length === 0 || value === "/") {
    return;
  }
  const key = `${start}:${end}:${value}`;
  if (!seen.has(key)) {
    seen.add(key);
    result.push({ end, kind, start, value });
  }
}
function addMatches(
  result: Candidate[],
  seen: Set<string>,
  text: string,
  pattern: RegExp,
  kind: Candidate["kind"],
): void {
  for (const match of text.matchAll(pattern)) {
    const value = match[0],
      start = match.index ?? 0;
    add(result, seen, value, start, start + value.length, kind);
  }
}
function addQuotedMatches(result: Candidate[], seen: Set<string>, text: string): void {
  for (const match of text.matchAll(quotedPattern)) {
    const value = match.groups?.value;
    if (value === undefined) {
      continue;
    }
    const start = (match.index ?? 0) + match[0].indexOf(value);
    add(result, seen, value, start, start + value.length, "quoted");
  }
}
function addSpanMatches(
  result: Candidate[],
  seen: Set<string>,
  text: string,
  maximumWords: number,
): void {
  for (const clause of text.matchAll(clausePattern)) {
    const clauseStart = clause.index ?? 0,
      clauseText = clause[0],
      tokens = [...clauseText.matchAll(tokenPattern)].map((token) => ({
        end: clauseStart + (token.index ?? 0) + token[0].length,
        hint: Number(pathHintPattern.test(token[0]) || variableHintPattern.test(token[0])),
        start: clauseStart + (token.index ?? 0),
        value: token[0],
      })),
      hintCounts = [0];
    for (const token of tokens) {
      hintCounts.push((hintCounts.at(-1) ?? 0) + token.hint);
    }
    for (let start = 0; start < tokens.length; start += 1) {
      const last = Math.min(tokens.length, start + maximumWords);
      for (let end = start + 1; end <= last; end += 1) {
        const firstToken = tokens[start],
          lastToken = tokens[end - 1],
          hintsBefore = hintCounts[start],
          hintsAfter = hintCounts[end];
        if (
          firstToken === undefined ||
          lastToken === undefined ||
          hintsBefore === undefined ||
          hintsAfter === undefined ||
          hintsBefore === hintsAfter
        ) {
          continue;
        }
        const value = text.slice(firstToken.start, lastToken.end);
        if (pathHintPattern.test(value)) {
          add(result, seen, value, firstToken.start, lastToken.end, "span");
        }
      }
    }
  }
}
export function extractCandidates(text: string, level: SearchLevel): Candidate[] {
  const result: Candidate[] = [],
    seen = new Set<string>();
  addQuotedMatches(result, seen, text);
  addMatches(result, seen, text, explicitPattern, "explicit");
  if (level >= 2) {
    addMatches(result, seen, text, variablePathPattern, "heuristic");
    addMatches(result, seen, text, pathTokenPattern, "heuristic");
  }
  if (level >= 3) {
    const maximumWords =
      settings.spanWordLimits[Math.min(level - 3, settings.spanWordLimits.length - 1)];
    if (maximumWords === undefined) {
      throw new RangeError("No text-span level is configured");
    }
    addSpanMatches(result, seen, text, maximumWords);
  }
  return result;
}
