import { pathToFileURL } from "node:url";

export function createCorpus({ absolute, escapedAbsolute, spacedAbsolute }) {
  return [
    {
      expected: ["src/index.ts"],
      feature: "explicit-relative",
      level: 1,
      text: "Please open ./src/index.ts before continuing.",
    },
    {
      expected: ["reports/quarterly report 2026.txt"],
      feature: "quoted-spaces",
      level: 1,
      text: `The report is "${spacedAbsolute}".`,
    },
    {
      expected: ["src/index.ts"],
      feature: "absolute",
      level: 1,
      text: `The source is at ${absolute}.`,
    },
    {
      expected: ["src/index.ts"],
      feature: "file-url",
      level: 1,
      text: `Import ${pathToFileURL(absolute).href}.`,
    },
    {
      expected: ["config/.env.local"],
      feature: "environment",
      level: 2,
      text: "Load %PROJECT_ROOT%/config/.env.local.",
    },
    {
      expected: ["package.json", "src/index.ts"],
      feature: "heuristic-relative",
      level: 2,
      text: "Compare package.json with src/index.ts in this change.",
    },
    {
      expected: ["docs/用户手册.md"],
      feature: "unicode",
      level: 2,
      text: "See docs/用户手册.md for details.",
    },
    {
      expected: ["data/[draft],final.csv"],
      feature: "path-punctuation",
      level: 2,
      text: "Use data/[draft],final.csv as the source.",
    },
    {
      expected: ["src/index.ts"],
      feature: "location-suffix",
      level: 2,
      text: "The error is in src/index.ts:12:4, according to the trace.",
    },
    {
      expected: ["reports/quarterly report 2026.txt"],
      feature: "unquoted-spaces",
      level: 3,
      text: "Store reports/quarterly report 2026.txt before the release.",
    },
    {
      expected: ["folder with spaces/meeting notes"],
      feature: "extensionless-spaces",
      level: 4,
      text: "The notes are in folder with spaces/meeting notes.",
    },
    {
      expected: ["LICENSE", "release notes final"],
      feature: "direct-inventory",
      level: 5,
      text: "Check LICENSE and release notes final before publishing.",
    },
    {
      expected: ["hash#tag.md", "weird%name.txt"],
      feature: "span-symbols",
      level: 2,
      text: "The files are hash#tag.md and weird%name.txt.",
    },
    {
      expected: ["archive/a/b/c/d/backup bundle"],
      feature: "deep-span",
      level: 3,
      text: "The old bundle is archive/a/b/c/d/backup bundle.",
    },
    {
      expected: [
        "very long folder name/with a surprisingly descriptive annual planning document.txt",
      ],
      feature: "long-span",
      level: 4,
      text: "Review very long folder name/with a surprisingly descriptive annual planning document.txt tomorrow.",
    },
    {
      expected: ["src/index.ts"],
      feature: "escaped-absolute",
      level: 2,
      text: `A JSON value contains ${escapedAbsolute}.`,
    },
    {
      expected: ["src/index.ts"],
      feature: "absolute-location",
      level: 1,
      text: `Diagnostics point to ${absolute}:18.`,
    },
    {
      expected: ["src"],
      feature: "explicit-directory",
      level: 1,
      text: "Use ./src as the source directory.",
    },
    {
      expected: ["reports"],
      feature: "inventory-directory",
      level: 5,
      text: "Review reports before publishing.",
    },
    {
      expected: ["shared/config.json", "@secondary/shared/config.json"],
      feature: "multiple-roots",
      level: 2,
      text: "Compare shared/config.json in both workspaces.",
    },
    {
      expected: ["@secondary/other/outline"],
      feature: "secondary-root",
      level: 2,
      text: "Open other/outline before the meeting.",
    },
  ];
}
