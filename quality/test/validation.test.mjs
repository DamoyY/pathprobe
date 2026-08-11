import assert from "node:assert/strict";
import { hostname } from "node:os";
import nodePath from "node:path";
import { after, before, test } from "node:test";
import { MAX_LEVEL, findExistingPaths } from "../../dist/index.mjs";
import { createFixture } from "../benchmark/fixture.mjs";

let fixture;
function find(text, level, options = {}) {
  return findExistingPaths({ directories: fixture.directories, level, text, ...options });
}
function localUncPath(filePath, server, extended = false) {
  const { root } = nodePath.parse(filePath);
  if (!/^[A-Za-z]:\\$/u.test(root)) {
    throw new TypeError(`${filePath} is not on a Windows drive`);
  }
  const prefix = extended ? "\\\\?\\UNC\\" : String.raw`\\`;
  return `${prefix}${server}\\${root[0]}$\\${filePath.slice(root.length)}`;
}
before(async () => {
  fixture = await createFixture({ noiseFilesPerRoot: 0 });
});
after(async () => {
  await fixture.cleanup();
});
void test("rejects invalid input levels", async () => {
  await assert.rejects(find("package.json", 0), RangeError);
  await assert.rejects(find("package.json", MAX_LEVEL + 1), RangeError);
  await assert.rejects(find("package.json", 1.5), RangeError);
});
void test("rejects invalid search directories", async () => {
  await assert.rejects(find("package.json", 1, { directories: [] }), RangeError);
  await assert.rejects(
    find("package.json", 1, {
      directories: [fixture.pathFor("missing")],
    }),
    {
      code: "ENOENT",
    },
  );
  await assert.rejects(
    find("package.json", 1, { directories: [fixture.pathFor("package.json")] }),
    TypeError,
  );
});
void test("allows absolute paths outside the search directories", async () => {
  const found = await find(`"${fixture.root}"`, 1);
  assert.deepEqual(found, [
    {
      kind: "directory",
      path: fixture.root,
      position: { end: fixture.root.length + 1, start: 1 },
    },
  ]);
});
void test("allows relative paths to resolve outside the search directories", async () => {
  const relative = nodePath.relative(fixture.primary, fixture.root),
    value = nodePath.join(relative, "global.ignore"),
    found = await find(`"${value}"`, 1);
  assert.deepEqual(found, [
    {
      kind: "file",
      path: nodePath.join(fixture.root, "global.ignore"),
      position: { end: value.length + 1, start: 1 },
    },
  ]);
});
void test("allows the search directories themselves", async () => {
  const found = await find(`"${fixture.primary}"`, 1, {
    respectIgnore: false,
    searchHidden: true,
  });
  assert.deepEqual(found, [
    {
      kind: "directory",
      path: fixture.primary,
      position: { end: fixture.primary.length + 1, start: 1 },
    },
  ]);
});
void test("rejects invalid variables and boolean controls", async () => {
  await assert.rejects(findExistingPaths(null), TypeError);
  await assert.rejects(find("package.json", 1, { variables: [] }), TypeError);
  await assert.rejects(find("package.json", 1, { respectIgnore: "yes" }), TypeError);
  await assert.rejects(find("package.json", 1, { searchHidden: 1 }), TypeError);
});
void test("discards candidates containing null bytes while preserving valid candidates", async () => {
  const invalid = `${fixture.pathFor("missing.txt")}\0`,
    text = `${invalid} package.json`,
    found = await find(text, 2);
  assert.deepEqual(found, [
    {
      kind: "file",
      path: fixture.pathFor("package.json"),
      position: {
        end: text.length,
        start: invalid.length + 1,
      },
    },
  ]);
});
void test(
  "discards invalid quoted Windows candidates before applying search policies",
  { skip: process.platform !== "win32" },
  async () => {
    const drive = nodePath.parse(fixture.primary).root.slice(0, 2);
    assert.deepEqual(await find(`"starting_directory: ${drive}"`, 1), []);
  },
);
void test(
  "preserves valid Windows candidates nested within invalid spans",
  { skip: process.platform !== "win32" },
  async () => {
    const driveRoot = nodePath.parse(fixture.primary).root,
      prefix = "starting_directory: ",
      text = `${prefix}${driveRoot}`;
    assert.deepEqual(await find(text, 3), [
      {
        kind: "directory",
        path: driveRoot,
        position: { end: text.length, start: prefix.length },
      },
    ]);
  },
);
void test(
  "discards invalid Windows candidates during batch validation",
  { skip: process.platform !== "win32" },
  async () => {
    const drive = nodePath.parse(fixture.primary).root.slice(0, 2),
      text = Array.from(
        { length: 32 },
        (_, index) => `"starting_directory_${index}: ${drive}"`,
      ).join(" ");
    assert.deepEqual(await find(text, 1), []);
  },
);
void test(
  "rejects remote UNC paths before filesystem probing",
  { skip: process.platform !== "win32", timeout: 2000 },
  async () => {
    const remotePaths = [
      "\\\\n\\n\\",
      String.raw`\\203.0.113.1\share\file`,
      String.raw`\\?\UNC\203.0.113.1\share\file`,
      String.raw`\\.\pipe\pathprobe`,
      String.raw`\\?\C:\pathprobe`,
      String.raw`\\localhost`,
      "file://203.0.113.1/share/file",
    ];
    assert.deepEqual(
      await Promise.all(
        remotePaths.map((value) => find(value, 1, { respectIgnore: false, searchHidden: true })),
      ),
      remotePaths.map(() => []),
    );
    assert.deepEqual(
      await find('"$SERVER/share/file"', 1, {
        respectIgnore: false,
        searchHidden: true,
        variables: { SERVER: "\\\\203.0.113.1" },
      }),
      [],
    );
  },
);
void test("accepts local UNC server aliases", { skip: process.platform !== "win32" }, async () => {
  const target = fixture.pathFor("package.json"),
    aliases = new Set(["localhost", "LOCALHOST.", "127.0.0.42", hostname()]),
    aliasValues = [...aliases].map((alias) => localUncPath(target, alias));
  assert.deepEqual(
    await Promise.all(
      aliasValues.map((value) => find(value, 1, { respectIgnore: false, searchHidden: true })),
    ),
    aliasValues.map((value) => [
      {
        kind: "file",
        path: target,
        position: { end: value.length, start: 0 },
      },
    ]),
  );
  const extended = localUncPath(target, "127.0.0.1", true);
  assert.deepEqual(await find(extended, 1, { respectIgnore: false, searchHidden: true }), [
    {
      kind: "file",
      path: target,
      position: { end: extended.length, start: 0 },
    },
  ]);
});
void test(
  "normalizes UNC search directories to drive paths",
  { skip: process.platform !== "win32" },
  async () => {
    const uncRoot = localUncPath(fixture.primary, "localhost");
    assert.deepEqual(
      await find("package.json", 2, {
        directories: [uncRoot],
        respectIgnore: false,
        searchHidden: true,
      }),
      [
        {
          kind: "file",
          path: fixture.pathFor("package.json"),
          position: { end: "package.json".length, start: 0 },
        },
      ],
    );
  },
);
