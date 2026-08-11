import type { SearchSettings } from "../src/types.js";

export const settings: SearchSettings = {
  batchValidationThreshold: 48,
  directoryScanThreshold: 2,
  ignoreFileNames: [".ignore", ".rgignore"],
  locationSuffixPattern: /:(?<line>\d+)(?::(?<column>\d+))?$/u,
  respectIgnoreByDefault: true,
  searchHiddenByDefault: false,
  spanWordLimits: [3, 24],
  trailingPunctuation: ".,;:!?，。；：！？、",
  validationConcurrency: 32,
};
