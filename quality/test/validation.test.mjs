import assert from "node:assert/strict";
import { hostname } from "node:os";
import nodePath from "node:path";
import { after, before, test } from "node:test";
import { findExistingPaths, MAX_LEVEL } from "../../dist/index.mjs";
import { createFixture } from "../benchmark/fixture.mjs";

let fixture;
function localUncPath(filePath, server, extended = false) {
  const { root } = nodePath.parse(filePath);
  if (!/^[A-Za-z]:\\$/u.test(root)) {
    throw new TypeError(`${filePath} is not on a Windows drive`);
  }
  const prefix = extended ? "\\\\?\\UNC\\" : "\\\\";
  return `${prefix}${server}\\${root[0]}$\\${filePath.slice(root.length)}`;
}
before(async () => {
  fixture = await createFixture({ noiseFilesPerRoot: 0 });
});
after(async () => {
  await fixture.cleanup();
});
test("rejects invalid input levels", async () => {
  await assert.rejects(findExistingPaths("package.json", 0, fixture.directories), RangeError);
  await assert.rejects(
    findExistingPaths("package.json", MAX_LEVEL + 1, fixture.directories),
    RangeError,
  );
  await assert.rejects(findExistingPaths("package.json", 1.5, fixture.directories), RangeError);
});
test("rejects invalid search directories", async () => {
  await assert.rejects(findExistingPaths("package.json", 1, []), RangeError);
  await assert.rejects(findExistingPaths("package.json", 1, [fixture.pathFor("missing")]), {
    code: "ENOENT",
  });
  await assert.rejects(
    findExistingPaths("package.json", 1, [fixture.pathFor("package.json")]),
    TypeError,
  );
});
test("allows absolute paths outside the search directories", async () => {
  const found = await findExistingPaths(`"${fixture.root}"`, 1, fixture.directories);
  assert.deepEqual(found, [
    {
      kind: "directory",
      path: fixture.root,
      position: { end: fixture.root.length + 1, start: 1 },
    },
  ]);
});
test("allows relative paths to resolve outside the search directories", async () => {
  const relative = nodePath.relative(fixture.primary, fixture.root);
  const value = nodePath.join(relative, "global.ignore");
  const found = await findExistingPaths(`"${value}"`, 1, fixture.directories);
  assert.deepEqual(found, [
    {
      kind: "file",
      path: nodePath.join(fixture.root, "global.ignore"),
      position: { end: value.length + 1, start: 1 },
    },
  ]);
});
test("allows the search directories themselves", async () => {
  const found = await findExistingPaths(
    `"${fixture.primary}"`,
    1,
    fixture.directories,
    {},
    false,
    true,
  );
  assert.deepEqual(found, [
    {
      kind: "directory",
      path: fixture.primary,
      position: { end: fixture.primary.length + 1, start: 1 },
    },
  ]);
});
test("rejects invalid variables and boolean controls", async () => {
  await assert.rejects(findExistingPaths("package.json", 1, fixture.directories, []), TypeError);
  await assert.rejects(
    findExistingPaths("package.json", 1, fixture.directories, {}, "yes"),
    TypeError,
  );
  await assert.rejects(
    findExistingPaths("package.json", 1, fixture.directories, {}, true, 1),
    TypeError,
  );
});
test(
  "rejects remote UNC paths before filesystem probing",
  { skip: process.platform !== "win32", timeout: 2_000 },
  async () => {
    const remotePaths = [
      "\\\\n\\n\\",
      "\\\\203.0.113.1\\share\\file",
      "\\\\?\\UNC\\203.0.113.1\\share\\file",
      "\\\\.\\pipe\\pathprobe",
      "\\\\?\\C:\\pathprobe",
      "\\\\localhost",
      "file://203.0.113.1/share/file",
    ];
    assert.deepEqual(
      await Promise.all(
        remotePaths.map((value) =>
          findExistingPaths(value, 1, fixture.directories, {}, false, true),
        ),
      ),
      remotePaths.map(() => []),
    );
    assert.deepEqual(
      await findExistingPaths(
        '"$SERVER/share/file"',
        1,
        fixture.directories,
        { SERVER: "\\\\203.0.113.1" },
        false,
        true,
      ),
      [],
    );
  },
);
test("accepts local UNC server aliases", { skip: process.platform !== "win32" }, async () => {
  const target = fixture.pathFor("package.json");
  const aliases = new Set(["localhost", "LOCALHOST.", "127.0.0.42", hostname()]);
  const aliasValues = [...aliases].map((alias) => localUncPath(target, alias));
  assert.deepEqual(
    await Promise.all(
      aliasValues.map((value) => findExistingPaths(value, 1, fixture.directories, {}, false, true)),
    ),
    aliasValues.map((value) => [
      {
        kind: "file",
        path: localUncPath(target, "localhost"),
        position: { end: value.length, start: 0 },
      },
    ]),
  );
  const extended = localUncPath(target, "127.0.0.1", true);
  assert.deepEqual(await findExistingPaths(extended, 1, fixture.directories, {}, false, true), [
    {
      kind: "file",
      path: localUncPath(target, "localhost", true),
      position: { end: extended.length, start: 0 },
    },
  ]);
});
