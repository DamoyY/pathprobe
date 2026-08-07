export type SearchLevel = number;
export type CandidateKind = "explicit" | "heuristic" | "inventory" | "quoted" | "span";
export interface Candidate {
  end: number;
  kind: CandidateKind;
  start: number;
  value: string;
}
export interface SearchSettings {
  locationSuffixPattern: RegExp;
  spanWordLimits: number[];
  trailingPunctuation: string;
  validationConcurrency: number;
}
