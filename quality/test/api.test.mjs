import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { findExistingFilePaths, MAX_LEVEL } from "../../dist/index.mjs";
import { createFixture, expectedPaths } from "../benchmark/fixture.mjs";

let fixture;

before(async () => {
  fixture = await createFixture();
});

after(async () => {
  await fixture.cleanup();
});

test("finds every expected file at the highest level", async () => {
  const text = fixture.cases.map((item) => item.text).join("\n");
  const found = new Set(await findExistingFilePaths(text, MAX_LEVEL, fixture.cwd));
  assert.deepEqual(found, expectedPaths(fixture));
});

test("finds each feature by its documented minimum level", async () => {
  const results = await Promise.all(
    fixture.cases.map((item) => findExistingFilePaths(item.text, item.level, fixture.cwd)),
  );
  for (const [index, item] of fixture.cases.entries()) {
    const found = new Set(results[index]);
    for (const relative of item.expected) {
      assert.ok(found.has(fixture.pathFor(relative)), item.feature);
    }
  }
});

test("keeps a missing path and a directory out of the result", async () => {
  const found = await findExistingFilePaths(
    "Try package.json, missing.txt, and src.",
    5,
    fixture.cwd,
  );
  assert.deepEqual(found, [fixture.pathFor("package.json")]);
});

test("rejects invalid input levels", async () => {
  await assert.rejects(findExistingFilePaths("package.json", 0, fixture.cwd), RangeError);
  await assert.rejects(
    findExistingFilePaths("package.json", MAX_LEVEL + 1, fixture.cwd),
    RangeError,
  );
  await assert.rejects(findExistingFilePaths("package.json", 1.5, fixture.cwd), RangeError);
});

test("rejects an invalid working directory", async () => {
  await assert.rejects(findExistingFilePaths("package.json", 1, fixture.pathFor("missing")), {
    code: "ENOENT",
  });
  await assert.rejects(
    findExistingFilePaths("package.json", 1, fixture.pathFor("package.json")),
    TypeError,
  );
});
