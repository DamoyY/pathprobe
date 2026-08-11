import type { AhoCorasick } from "@monyone/aho-corasick";

export type SearchLevel = number;
export type PathKind = "directory" | "file";
export interface PathPosition {
  end: number;
  start: number;
}
export interface PathLocation {
  column?: number;
  line: number;
}
export interface PathMatch {
  kind: PathKind;
  location?: PathLocation;
  path: string;
  position: PathPosition;
}
export interface FindExistingPathsOptions {
  directories: readonly string[];
  level: SearchLevel;
  respectIgnore?: boolean;
  searchHidden?: boolean;
  text: string;
  variables?: Variables;
}
export interface InventoryPattern {
  expectedKind: PathKind;
  relative: string;
  value: string;
}
export interface InventoryMatcher {
  entries: readonly (readonly SearchEntry[])[];
  matcher: AhoCorasick;
  patterns: Map<string, InventoryPattern>;
  prefixes: readonly RootPrefix[];
  respectIgnore: boolean;
  roots: readonly string[];
  searchHidden: boolean;
}
export interface RootPrefix {
  root: string;
  value: string;
}
export interface SearchEntry {
  directory: boolean;
  path: string;
}
export type CandidateKind = "explicit" | "heuristic" | "inventory" | "quoted" | "span";
export interface Candidate {
  end: number;
  expectedKind?: PathKind;
  kind: CandidateKind;
  start: number;
  value: string;
}
export interface SearchSettings {
  batchValidationThreshold: number;
  directoryScanThreshold: number;
  ignoreFileNames: string[];
  locationSuffixPattern: RegExp;
  respectIgnoreByDefault: boolean;
  searchHiddenByDefault: boolean;
  spanWordLimits: number[];
  trailingPunctuation: string;
  validationConcurrency: number;
}
export type Variables = Readonly<Record<string, string>>;
