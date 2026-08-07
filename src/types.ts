export type SearchLevel = number;
export type CandidateKind = "explicit" | "heuristic" | "inventory" | "quoted" | "span";
export interface Candidate {
  end: number;
  kind: CandidateKind;
  start: number;
  value: string;
}
export interface SearchSettings {
  ignoreFilePatterns: string[];
  locationSuffixPattern: RegExp;
  respectIgnoreByDefault: boolean;
  searchHiddenByDefault: boolean;
  spanWordLimits: number[];
  trailingPunctuation: string;
  validationConcurrency: number;
}
export type Variables = Readonly<Record<string, string>>;
