import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";
import { pathToFileURL } from "node:url";

const files = [
  "package.json",
  "src/index.ts",
  "src/components/Primary Button.tsx",
  "docs/用户手册.md",
  "reports/quarterly report 2026.txt",
  "LICENSE",
  "release notes final",
  "folder with spaces/meeting notes",
  "data/[draft],final.csv",
  "config/.env.local",
  "hash#tag.md",
  "weird%name.txt",
  "archive/a/b/c/d/backup bundle",
  "very long folder name/with a surprisingly descriptive annual planning document.txt",
];

async function createFiles(root) {
  await Promise.all(
    files.map(async (relative) => {
      const filePath = nodePath.join(root, relative);
      await mkdir(nodePath.dirname(filePath), { recursive: true });
      await writeFile(filePath, relative);
    }),
  );

  const noise = Array.from({ length: 600 }, (_, index) =>
    nodePath.join(root, "noise", `entry-${index}.txt`),
  );
  await Promise.all(
    noise.map(async (filePath) => {
      await mkdir(nodePath.dirname(filePath), { recursive: true });
      await writeFile(filePath, "noise");
    }),
  );
}

export async function createFixture() {
  const root = await mkdtemp(nodePath.join(os.tmpdir(), "realpath-text-"));
  const cwd = root;
  await createFiles(cwd);

  const pathFor = (relative) => nodePath.resolve(cwd, relative);
  const absolute = pathFor("src/index.ts");
  const spacedAbsolute = pathFor("reports/quarterly report 2026.txt");
  const escapedAbsolute = absolute.replaceAll("\\", "\\\\");
  process.env.REALPATH_TEXT_FIXTURE = cwd;

  const cases = [
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
      text: "Load %REALPATH_TEXT_FIXTURE%/config/.env.local.",
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
      text: "Archive reports/quarterly report 2026.txt before the release.",
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
      text: "The old archive is archive/a/b/c/d/backup bundle.",
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
  ];

  return {
    cases,
    cwd,
    pathFor,
    root,
    cleanup: () => rm(root, { force: true, recursive: true }),
  };
}

export function expectedPaths(fixture) {
  return new Set(
    fixture.cases.flatMap((item) => item.expected.map((relative) => fixture.pathFor(relative))),
  );
}
