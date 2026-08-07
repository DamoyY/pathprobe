import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";
import { createCorpus } from "./corpus.mjs";

const primaryFiles = [
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
  "shared/config.json",
  "ignored/git.txt",
  "ignored/local.txt",
  "ignored/rg.txt",
  "ignored/global.txt",
  "ignored/git-dir/item.txt",
  ".hidden/secret.txt",
];

const secondaryFiles = ["other/outline", "shared/config.json"];

async function createFiles(root, files) {
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
  const primary = nodePath.join(root, "primary");
  const secondary = nodePath.join(root, "secondary");
  await Promise.all([createFiles(primary, primaryFiles), createFiles(secondary, secondaryFiles)]);
  await Promise.all([
    writeFile(nodePath.join(primary, ".gitignore"), "/ignored/git.txt\n/ignored/git-dir/\n"),
    writeFile(nodePath.join(primary, ".ignore"), "/ignored/local.txt\n"),
    writeFile(nodePath.join(primary, ".rgignore"), "/ignored/rg.txt\n"),
  ]);
  const globalIgnore = nodePath.join(root, "global.ignore");
  const globalConfig = nodePath.join(root, "global.gitconfig");
  await Promise.all([
    writeFile(globalIgnore, "/ignored/global.txt\n"),
    writeFile(globalConfig, `[core]\n\texcludesFile = ${globalIgnore.replaceAll("\\", "/")}\n`),
  ]);

  const pathFor = (relative) =>
    relative.startsWith("@secondary/")
      ? nodePath.resolve(secondary, relative.slice("@secondary/".length))
      : nodePath.resolve(primary, relative);
  const absolute = pathFor("src/index.ts");
  const spacedAbsolute = pathFor("reports/quarterly report 2026.txt");
  const escapedAbsolute = absolute.replaceAll("\\", "\\\\");
  const variables = { PROJECT_ROOT: primary };

  const cases = createCorpus({
    absolute,
    escapedAbsolute,
    spacedAbsolute,
  });

  return {
    cases,
    directories: [primary, secondary],
    hiddenPaths: ["config/.env.local", ".hidden/secret.txt"],
    ignoredPaths: [
      "ignored/git.txt",
      "ignored/local.txt",
      "ignored/rg.txt",
      "ignored/global.txt",
      "ignored/git-dir/item.txt",
    ],
    globalConfig,
    pathFor,
    primary,
    root,
    secondary,
    variables,
    cleanup: () => rm(root, { force: true, recursive: true }),
  };
}

export function expectedPaths(fixture) {
  return new Set(
    fixture.cases.flatMap((item) => item.expected.map((relative) => fixture.pathFor(relative))),
  );
}
