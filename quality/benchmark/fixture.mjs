import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";
import { fixtureSettings } from "../../config/benchmark.mjs";
import { additionalFiles } from "./cases/paths.mjs";
import { createCorpus } from "./corpus.mjs";
import { createFileTree } from "./tree.mjs";

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
  ...additionalFiles,
];
const secondaryFiles = ["other/outline", "shared/config.json"];
export async function createFixture(options = {}) {
  const noiseFilesPerRoot = options.noiseFilesPerRoot ?? fixtureSettings.noiseFilesPerRoot;
  const writeConcurrency = options.writeConcurrency ?? fixtureSettings.writeConcurrency;
  const root = await mkdtemp(nodePath.join(os.tmpdir(), "pathprobe-"));
  const primary = nodePath.join(root, "primary");
  const secondary = nodePath.join(root, "secondary");
  const [primarySummary, secondarySummary] = await Promise.all([
    createFileTree(primary, primaryFiles, noiseFilesPerRoot, writeConcurrency),
    createFileTree(secondary, secondaryFiles, noiseFilesPerRoot, writeConcurrency),
  ]);
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
  const uncAbsolute =
    process.platform === "win32"
      ? `\\\\localhost\\${absolute.slice(0, 1)}$${absolute.slice(2)}`
      : undefined;
  const variables = {
    CONFIG_ROOT: "config",
    PROJECT_ROOT: primary,
    WORKSPACE_ROOT: primary,
    "project.root": primary,
  };
  const cases = createCorpus({
    absolute,
    escapedAbsolute,
    spacedAbsolute,
    uncAbsolute,
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
    stats: {
      directories: primarySummary.directories + secondarySummary.directories,
      files: primarySummary.files + secondarySummary.files + 5,
    },
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
