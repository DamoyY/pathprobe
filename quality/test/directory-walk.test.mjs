import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import nodePath from "node:path";
import process from "node:process";
import { globby } from "globby";
import { createJiti } from "jiti";

const { createTraversalFileSystem } = await createJiti(import.meta.url).import(
  "../../src/search/traversal.ts",
);
function failingReadDirectory(code) {
  function readDirectory(_filePath, optionsOrCallback, entryCallback) {
    const callback = typeof optionsOrCallback === "function" ? optionsOrCallback : entryCallback,
      error = Object.assign(new Error(`Injected ${code}`), { code });
    if (callback === undefined) {
      throw new TypeError("A directory entry callback is required");
    }
    callback(error, []);
  }
  return readDirectory;
}
function setHidden(filePath) {
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
void test("treats inaccessible or vanished directories as empty subtrees", async () => {
  const codes = ["EACCES", "ENOTDIR", "ENOENT", "EPERM"],
    results = await Promise.all(
      codes.map((code) =>
        globby("**/*", {
          cwd: process.cwd(),
          fs: createTraversalFileSystem(process.cwd(), true, {
            readDirectory: failingReadDirectory(code),
          }),
          onlyFiles: false,
        }),
      ),
    );
  assert.deepEqual(
    results,
    codes.map(() => []),
  );
});
void test("propagates unexpected directory read failures", async () => {
  const fileSystem = createTraversalFileSystem(process.cwd(), true, {
    readDirectory: failingReadDirectory("EIO"),
  });
  await assert.rejects(
    globby("**/*", {
      cwd: process.cwd(),
      fs: fileSystem,
      onlyFiles: false,
    }),
    { code: "EIO" },
  );
});
void test("prunes hidden directories before recursive traversal", async () => {
  const root = await mkdtemp(nodePath.join(os.tmpdir(), "pathprobe-traversal-")),
    hiddenName = process.platform === "win32" ? "hidden-directory" : ".hidden",
    hiddenDirectory = nodePath.join(root, hiddenName);
  try {
    await mkdir(hiddenDirectory);
    await writeFile(nodePath.join(hiddenDirectory, "secret.txt"), "");
    setHidden(hiddenDirectory);
    const hiddenDisabled = await globby("**/*", {
        cwd: root,
        dot: true,
        fs: createTraversalFileSystem(root, false),
        onlyFiles: false,
      }),
      hiddenEnabled = await globby("**/*", {
        cwd: root,
        dot: true,
        fs: createTraversalFileSystem(root, true),
        onlyFiles: false,
      });
    assert.deepEqual(hiddenDisabled, []);
    assert.deepEqual(hiddenEnabled, [hiddenName, `${hiddenName.replaceAll("\\", "/")}/secret.txt`]);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
