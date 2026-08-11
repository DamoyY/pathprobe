import { settings } from "../../config/settings.js";
import type { Candidate, PathLocation, PathPosition } from "../types.js";

export interface PreparedCandidate {
  location?: PathLocation;
  position: PathPosition;
  value: string;
}
function parseLocationPart(value: string, name: string): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError(`${name} must be a safe integer`);
  }
  return result;
}
export function prepareCandidate(candidate: Candidate): PreparedCandidate | undefined {
  let { end } = candidate,
    { start } = candidate,
    { value } = candidate;
  if (candidate.kind !== "inventory" && candidate.kind !== "quoted") {
    const startTrimmed = value.trimStart();
    start += value.length - startTrimmed.length;
    value = startTrimmed;
    const endTrimmed = value.trimEnd();
    end -= value.length - endTrimmed.length;
    value = endTrimmed;
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.at(-1) === '"') ||
        (value.startsWith("'") && value.at(-1) === "'") ||
        (value.startsWith("`") && value.at(-1) === "`"))
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
  let location: PathLocation | undefined;
  if (candidate.kind !== "inventory") {
    const match = settings.locationSuffixPattern.exec(value);
    if (match !== null) {
      const lineValue = match.groups?.line;
      if (lineValue === undefined) {
        throw new TypeError("locationSuffixPattern must capture a line");
      }
      const columnValue = match.groups?.column;
      location =
        columnValue === undefined
          ? { line: parseLocationPart(lineValue, "line") }
          : {
              column: parseLocationPart(columnValue, "column"),
              line: parseLocationPart(lineValue, "line"),
            };
      end -= match[0].length;
      value = value.slice(0, match.index);
    }
  }
  if (value === "/") {
    return undefined;
  }
  return {
    ...(location === undefined ? {} : { location }),
    position: { end, start },
    value,
  };
}
