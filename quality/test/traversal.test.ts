import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";
import fastGlob from "fast-glob";
import { createTraversalFileSystem } from "../../src/search/traversal.ts";

type ReadDirectory = fastGlob.FileSystemAdapter["readdir"];
function failingReadDirectory(code: string): ReadDirectory {
  return ((_filePath, optionsOrCallback, entryCallback) => {
    const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : entryCallback,
      error = Object.assign(new Error(`Injected ${code}`), { code });
    callback(error, []);
  }) as ReadDirectory;
}
function setHidden(filePath: string): void {
  if (process.platform !== "win32") {
    return;
  }
  const executable = nodePath.join(
      process.env.SystemRoot ?? String.raw`C:\Windows`,
      "System32",
      "attrib.exe",
    ),
    result = spawnSync(executable, ["+H", filePath], {
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
test("treats inaccessible or vanished directories as empty subtrees", async () => {
  const codes = ["EACCES", "ENOTDIR", "ENOENT", "EPERM"],
    results = await Promise.all(
      codes.map((code) =>
        fastGlob("**/*", {
          cwd: process.cwd(),
          fs: createTraversalFileSystem(process.cwd(), true, {
            readDirectory: failingReadDirectory(code),
          }),
          onlyFiles: false,
        }),
      ),
    );
  expect(results).toEqual(codes.map(() => []));
});
test("propagates unexpected directory read failures", async () => {
  const fileSystem = createTraversalFileSystem(process.cwd(), true, {
    readDirectory: failingReadDirectory("EIO"),
  });
  expect(
    fastGlob("**/*", {
      cwd: process.cwd(),
      fs: fileSystem,
      onlyFiles: false,
    }),
  ).rejects.toMatchObject({ code: "EIO" });
});
test("prunes hidden directories before recursive traversal", async () => {
  const root = await mkdtemp(nodePath.join(os.tmpdir(), "pathprobe-traversal-")),
    hiddenName = process.platform === "win32" ? "hidden-directory" : ".hidden",
    hiddenDirectory = nodePath.join(root, hiddenName);
  try {
    await mkdir(hiddenDirectory);
    await writeFile(nodePath.join(hiddenDirectory, "secret.txt"), "");
    setHidden(hiddenDirectory);
    const hiddenDisabled = await fastGlob("**/*", {
        cwd: root,
        dot: true,
        fs: createTraversalFileSystem(root, false),
        onlyFiles: false,
      }),
      hiddenEnabled = await fastGlob("**/*", {
        cwd: root,
        dot: true,
        fs: createTraversalFileSystem(root, true),
        onlyFiles: false,
      });
    expect(hiddenDisabled).toEqual([]);
    expect(hiddenEnabled).toEqual([hiddenName, `${hiddenName.replaceAll("\\", "/")}/secret.txt`]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
