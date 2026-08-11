import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";
import { fixtureSettings } from "../../config/benchmark.mjs";
import { edgeFiles } from "./cases/edge-cases.mjs";
import { additionalFiles } from "./cases/paths.mjs";
import { workloadFiles } from "./cases/workloads.mjs";
import { createCorpus } from "./corpus.mjs";
import { countPaths } from "./path-counts.mjs";
import { createFileTree } from "./tree.mjs";

export { countPaths } from "./path-counts.mjs";
const dotPaths = ["config/.env.local", ".hidden/secret.txt"],
  windowsHiddenPaths = ["hidden-attribute.txt", "hidden-directory/secret.txt"],
  primaryFiles = [
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
    ...(process.platform === "win32" ? windowsHiddenPaths : []),
    ...additionalFiles,
    ...workloadFiles,
    ...edgeFiles,
  ],
  secondaryFiles = ["other/outline", "shared/config.json"];
function setWindowsHiddenAttributes(root) {
  if (process.platform !== "win32") {
    return;
  }
  const systemRoot = process.env.SystemRoot;
  if (systemRoot === undefined) {
    throw new Error("SystemRoot is required to set Windows hidden attributes");
  }
  const executable = nodePath.join(systemRoot, "System32", "attrib.exe");
  for (const relative of ["hidden-attribute.txt", "hidden-directory"]) {
    const result = spawnSync(executable, ["+H", nodePath.join(root, relative)], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.error !== undefined) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`attrib.exe failed with status ${result.status}: ${result.stderr}`);
    }
  }
}
export async function createFixture(options = {}) {
  const noiseFilesPerRoot = options.noiseFilesPerRoot ?? fixtureSettings.noiseFilesPerRoot,
    writeConcurrency = options.writeConcurrency ?? fixtureSettings.writeConcurrency,
    root = await mkdtemp(nodePath.join(os.tmpdir(), "pathprobe-")),
    primary = nodePath.join(root, "primary"),
    secondary = nodePath.join(root, "secondary"),
    [primarySummary, secondarySummary] = await Promise.all([
      createFileTree(primary, primaryFiles, noiseFilesPerRoot, writeConcurrency),
      createFileTree(secondary, secondaryFiles, noiseFilesPerRoot, writeConcurrency),
    ]);
  setWindowsHiddenAttributes(primary);
  await Promise.all([
    writeFile(nodePath.join(primary, ".gitignore"), "/ignored/git.txt\n/ignored/git-dir/\n"),
    writeFile(nodePath.join(primary, ".ignore"), "/ignored/local.txt\n"),
    writeFile(nodePath.join(primary, ".rgignore"), "/ignored/rg.txt\n"),
  ]);
  const globalIgnore = nodePath.join(root, "global.ignore"),
    globalConfig = nodePath.join(root, "global.gitconfig");
  await Promise.all([
    writeFile(globalIgnore, "/ignored/global.txt\n"),
    writeFile(globalConfig, `[core]\n\texcludesFile = ${globalIgnore.replaceAll("\\", "/")}\n`),
  ]);
  const pathFor = (relative) =>
      relative.startsWith("@secondary/")
        ? nodePath.resolve(secondary, relative.slice("@secondary/".length))
        : nodePath.resolve(primary, relative),
    absolute = pathFor("src/index.ts"),
    spacedAbsolute = pathFor("reports/quarterly report 2026.txt"),
    escapedAbsolute = absolute.replaceAll("\\", String.raw`\\`),
    uncAbsolute =
      process.platform === "win32"
        ? `\\\\localhost\\${absolute.slice(0, 1)}$${absolute.slice(2)}`
        : undefined,
    variables = {
      CONFIG_ROOT: "config",
      PROJECT_ROOT: primary,
      WORKSPACE_ROOT: primary,
      "project.root": primary,
    },
    cases = createCorpus({
      absolute,
      escapedAbsolute,
      nativeRelative: ["services", "auth", "config.production.json"].join(nodePath.sep),
      spacedAbsolute,
      uncAbsolute,
    });
  return {
    cases,
    cleanup: () => rm(root, { force: true, recursive: true }),
    directories: [primary, secondary],
    dotPaths,
    globalConfig,
    hiddenPaths: process.platform === "win32" ? windowsHiddenPaths : dotPaths,
    ignoredPaths: [
      "ignored/git.txt",
      "ignored/local.txt",
      "ignored/rg.txt",
      "ignored/global.txt",
      "ignored/git-dir/item.txt",
    ],
    pathFor,
    primary,
    root,
    secondary,
    stats: {
      directories: primarySummary.directories + secondarySummary.directories,
      files: primarySummary.files + secondarySummary.files + 5,
    },
    variables,
  };
}
export function expectedPathCounts(fixture) {
  return countPaths(
    fixture.cases.flatMap((item) => item.expected.map((relative) => fixture.pathFor(relative))),
  );
}
