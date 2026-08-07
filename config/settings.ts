import type { SearchSettings } from "../src/types.js";

export const settings: SearchSettings = {
  ignoreFilePatterns: ["**/.ignore", "**/.rgignore"],
  locationSuffixPattern: /(?::\d+){1,2}$/u,
  respectIgnoreByDefault: true,
  searchHiddenByDefault: false,
  spanWordLimits: [3, 24],
  trailingPunctuation: ".,;:!?，。；：！？、",
  validationConcurrency: 32,
};
