import assert from "node:assert/strict";
import { hostname } from "node:os";
import nodePath from "node:path";
import process from "node:process";
import { after, before, test } from "node:test";
import { findExistingPaths } from "../../../dist/index.mjs";
import { createFixture } from "../../benchmark/fixture.mjs";

let fixture;
function find(text, level, options = {}) {
  return findExistingPaths({ directories: fixture.directories, level, text, ...options });
}
function localUncPath(filePath, server, extended = false) {
  const { root } = nodePath.parse(filePath);
  assert.match(root, /^[A-Za-z]:\\$/u);
  const prefix = extended ? "\\\\?\\UNC\\" : String.raw`\\`;
  return `${prefix}${server}\\${root[0]}$\\${filePath.slice(root.length)}`;
}
before(async () => {
  fixture = await createFixture({ noiseFilesPerRoot: 0 });
});
after(async () => {
  await fixture.cleanup();
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
