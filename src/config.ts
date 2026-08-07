import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { SearchSettings } from "./types.js";

const settingsPath = new URL("../config/settings.yaml", import.meta.url);
const parsedSettings: unknown = parse(readFileSync(settingsPath, "utf8"));
function readSettings(value: unknown): SearchSettings {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("settings.yaml must contain a mapping");
  }
  const record = value as Record<string, unknown>;
  const spanWordLimits = positiveIntegerArray(record, "spanWordLimits");
  const validationConcurrency = positiveInteger(record, "validationConcurrency");
  if (
    typeof record.locationSuffixPattern !== "string" ||
    typeof record.trailingPunctuation !== "string"
  ) {
    throw new TypeError("locationSuffixPattern and trailingPunctuation must be strings");
  }
  return {
    locationSuffixPattern: new RegExp(record.locationSuffixPattern),
    spanWordLimits,
    trailingPunctuation: record.trailingPunctuation,
    validationConcurrency,
  };
}
function positiveIntegerArray(record: Record<string, unknown>, key: string): number[] {
  const value = record[key];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some(
      (item, index) =>
        typeof item !== "number" ||
        !Number.isInteger(item) ||
        item < 1 ||
        (index > 0 && item <= value[index - 1]),
    )
  ) {
    throw new TypeError(`${key} must be an increasing array of positive integers`);
  }
  return value;
}
function positiveInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new TypeError(`${key} must be a positive integer`);
  }
  return value;
}
export const settings = readSettings(parsedSettings);
