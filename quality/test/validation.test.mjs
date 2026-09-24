import assert from "node:assert/strict";
import nodePath from "node:path";
import { after, before, test } from "node:test";
import { MAX_LEVEL, findExistingPaths } from "../../dist/index.mjs";
import { createFixture } from "../benchmark/fixture.mjs";

let fixture;
function find(text, level, options = {}) {
  return findExistingPaths({ directories: fixture.directories, level, text, ...options });
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
