import assert from "node:assert/strict";
import nodePath from "node:path";
import { after, before, test } from "node:test";
import { findExistingPaths, MAX_LEVEL } from "../../dist/index.mjs";
import { createFixture } from "../benchmark/fixture.mjs";

let fixture;
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
