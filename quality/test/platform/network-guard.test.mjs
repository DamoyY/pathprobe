import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import nodePath from "node:path";
import process from "node:process";
import { after, before, test } from "node:test";
import { MAX_LEVEL, findExistingPaths } from "../../../dist/index.mjs";
import { createFixture } from "../../benchmark/fixture.mjs";

const windowsOnly = { skip: process.platform !== "win32" },
  originalFilesystem = { ...fs },
  originals = { readdir: fs.readdir, stat: fs.stat },
  runtimeMock = process.versions.bun === undefined ? undefined : (await import("bun:test")).mock,
  filesystemError = Object.assign(new Error("Filesystem failure"), { code: "ECONNRESET" }),
  networkProbes = [],
  prefixes = ["\\\\", "\\/", "/\\", "//"],
  inputs = prefixes.map((prefix) => `${prefix}${String.raw`u003e\u003c\p`}`),
  levels = Array.from({ length: MAX_LEVEL }, (_, index) => index + 1);
let fixture;
function find(text, level, options = {}) {
  return findExistingPaths({
    directories: fixture.directories,
    level,
    respectIgnore: false,
    searchHidden: true,
    text,
    ...options,
  });
}
before(async () => {
  fixture = await createFixture({ noiseFilesPerRoot: 0 });
  if (process.platform !== "win32") {
    return;
  }
  for (const [name, original] of Object.entries(originals)) {
    fs[name] = async (filePath, ...args) => {
      if (filePath === fixture.pathFor("io-failure")) {
        throw filesystemError;
      }
      if (String(filePath).startsWith(String.raw`\\`)) {
        networkProbes.push({ name, path: String(filePath) });
        throw Object.assign(new Error("Unexpected network filesystem probe"), {
          code: "ECONNRESET",
        });
      }
      return original(filePath, ...args);
    };
  }
  syncBuiltinESMExports();
  if (runtimeMock !== undefined) {
    const guardedFilesystem = { ...fs };
    runtimeMock.module("node:fs/promises", () => ({ ...guardedFilesystem, default: fs }));
  }
});
after(async () => {
  Object.assign(fs, originals);
  syncBuiltinESMExports();
  runtimeMock?.module("node:fs/promises", () => ({ ...originalFilesystem, default: fs }));
  await fixture.cleanup();
});
void test("preserves filesystem errors on local paths", windowsOnly, async () => {
  await assert.rejects(find(`"${fixture.pathFor("io-failure")}"`, 1), filesystemError);
});
void test("rejects escaped text before UNC probing at every level", windowsOnly, async () => {
  const cases = levels.flatMap((level) =>
    inputs.flatMap((input) => [input, `"${input}"`].map((text) => ({ level, text }))),
  );
  await Promise.all(
    cases.map(async ({ level, text }) => {
      assert.deepEqual(await find(text, level), [], JSON.stringify({ level, text }));
    }),
  );
  assert.deepEqual(networkProbes, []);
});
void test("rejects mixed-separator UNC variables before probing", windowsOnly, async () => {
  assert.deepEqual(
    await Promise.all(
      inputs.map((input) => find('"$REMOTE"', 1, { variables: { REMOTE: input } })),
    ),
    inputs.map(() => []),
  );
  assert.deepEqual(networkProbes, []);
});
void test(
  "rejects mixed-separator UNC search directories before probing",
  windowsOnly,
  async () => {
    await Promise.all(
      inputs.map((input) =>
        assert.rejects(find("package.json", 2, { directories: [input] }), TypeError),
      ),
    );
    assert.deepEqual(networkProbes, []);
  },
);
void test("preserves local matches alongside batches of UNC distractors", windowsOnly, async () => {
  const distractors = Array.from(
      { length: 64 },
      (_, index) => `"${inputs[index % inputs.length]}${index}"`,
    ).join(" "),
    text = `${distractors} "package.json"`;
  await Promise.all(
    levels.map(async (level) => {
      assert.deepEqual(await find(text, level), [
        {
          kind: "file",
          path: fixture.pathFor("package.json"),
          position: { end: text.length - 1, start: distractors.length + 2 },
        },
      ]);
    }),
  );
  assert.deepEqual(networkProbes, []);
});
void test("resolves local UNC aliases with mixed separators", windowsOnly, async () => {
  const target = fixture.pathFor("package.json"),
    { root } = nodePath.parse(target);
  await Promise.all(
    prefixes.map(async (prefix) => {
      const value = `${prefix}localhost\\${root[0]}$\\${target.slice(root.length)}`;
      assert.deepEqual(await find(`"${value}"`, 1), [
        {
          kind: "file",
          path: target,
          position: { end: value.length + 1, start: 1 },
        },
      ]);
    }),
  );
  assert.deepEqual(networkProbes, []);
});
