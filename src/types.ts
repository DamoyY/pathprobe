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
export type CandidateKind = "explicit" | "heuristic" | "inventory" | "quoted" | "span";
export interface Candidate {
  end: number;
  kind: CandidateKind;
  start: number;
  value: string;
}
export interface SearchSettings {
  batchValidationThreshold: number;
  directoryScanThreshold: number;
  ignoreFilePatterns: string[];
  locationSuffixPattern: RegExp;
  respectIgnoreByDefault: boolean;
  searchHiddenByDefault: boolean;
  spanWordLimits: number[];
  trailingPunctuation: string;
  validationConcurrency: number;
}
export type Variables = Readonly<Record<string, string>>;
