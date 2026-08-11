import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";
import { convertPathToPattern, globby } from "globby";
import isPathInside from "is-path-inside";
import { filterSearchablePaths } from "../../src/search/policy.ts";
import { createTraversalFileSystem } from "../../src/search/traversal.ts";

async function writeFiles(root: string, paths: readonly string[]): Promise<void> {
  await Promise.all(
    paths.map(async (relativePath) => {
      const filePath = nodePath.join(root, relativePath);
      await mkdir(nodePath.dirname(filePath), { recursive: true });
      await writeFile(filePath, "");
    }),
  );
}
async function referenceFilter(paths: readonly string[], root: string): Promise<Set<string>> {
  const relativePaths = paths
      .filter((filePath) => filePath !== root && isPathInside(filePath, root))
      .map((filePath) => nodePath.relative(root, filePath)),
    allowed = new Set(paths.filter((filePath) => filePath === root)),
    matches = await globby(relativePaths.map(convertPathToPattern), {
      absolute: true,
      caseSensitiveMatch: process.platform !== "win32",
      cwd: root,
      dot: true,
      expandDirectories: false,
      followSymbolicLinks: false,
      fs: createTraversalFileSystem(root, true),
      gitignore: true,
      globalGitignore: true,
      ignoreFiles: ["**/.ignore", "**/.rgignore"],
      onlyFiles: false,
      unique: true,
    });
  for (const match of matches) {
    allowed.add(nodePath.normalize(match));
  }
  return allowed;
}
test("matches the unscoped ignore traversal across rule sources and negations", async () => {
  const repository = await mkdtemp(nodePath.join(os.tmpdir(), "pathprobe-ignore-")),
    root = nodePath.join(repository, "project"),
    globalConfig = nodePath.join(repository, "global.gitconfig"),
    previousGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
  try {
    await Promise.all([
      mkdir(nodePath.join(repository, ".git")),
      mkdir(nodePath.join(root, "nested"), { recursive: true }),
    ]);
    await Promise.all([
      writeFiles(root, [
        "kept.txt",
        "parent-git.txt",
        "project-git.txt",
        "local.txt",
        "rg.txt",
        "shared.txt",
        "global.txt",
        "ignored-parent/recovered.txt",
        "nested/kept.txt",
        "nested/nested-git.txt",
        "nested/nested-local.txt",
        "nested/nested-rg.txt",
      ]),
      writeFile(
        nodePath.join(repository, ".gitignore"),
        "/project/parent-git.txt\n/project/ignored-parent/\n!/project/ignored-parent/recovered.txt\n",
      ),
      writeFile(nodePath.join(root, ".gitignore"), "/project-git.txt\n/shared.txt\n"),
      writeFile(nodePath.join(root, ".ignore"), "/local.txt\n!shared.txt\n"),
      writeFile(nodePath.join(root, ".rgignore"), "/rg.txt\n"),
      writeFile(nodePath.join(root, "nested", ".gitignore"), "/nested-git.txt\n"),
      writeFile(nodePath.join(root, "nested", ".ignore"), "/nested-local.txt\n"),
      writeFile(nodePath.join(root, "nested", ".rgignore"), "/nested-rg.txt\n"),
      writeFile(
        globalConfig,
        `[core]\n\texcludesFile = ${nodePath.join(repository, "global.ignore").replaceAll("\\", "/")}\n`,
      ),
      writeFile(nodePath.join(repository, "global.ignore"), "/project/global.txt\n"),
    ]);
    process.env.GIT_CONFIG_GLOBAL = globalConfig;
    const paths = [
      root,
      ...[
        "kept.txt",
        "parent-git.txt",
        "project-git.txt",
        "local.txt",
        "rg.txt",
        "shared.txt",
        "global.txt",
        "ignored-parent/recovered.txt",
        "nested/kept.txt",
        "nested/nested-git.txt",
        "nested/nested-local.txt",
        "nested/nested-rg.txt",
      ].map((relativePath) => nodePath.join(root, relativePath)),
    ];
    expect(await filterSearchablePaths(paths, [root], true, true)).toEqual(
      await referenceFilter(paths, root),
    );
  } finally {
    if (previousGlobalConfig === undefined) {
      delete process.env.GIT_CONFIG_GLOBAL;
    } else {
      process.env.GIT_CONFIG_GLOBAL = previousGlobalConfig;
    }
    await rm(repository, { force: true, recursive: true });
  }
});
