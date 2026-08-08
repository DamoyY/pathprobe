import assert from "node:assert/strict";
import nodePath from "node:path";
import { after, before, test } from "node:test";
import { findExistingPaths, MAX_LEVEL } from "../../dist/index.mjs";
import { createFixture, expectedPaths } from "../benchmark/fixture.mjs";

let fixture;
before(async () => {
  fixture = await createFixture();
});
after(async () => {
  await fixture.cleanup();
});
test("finds every expected path at the highest level", async () => {
  const text = fixture.cases.map((item) => item.text).join("\n");
  const found = new Set(
    await findExistingPaths(text, MAX_LEVEL, fixture.directories, fixture.variables, false, true),
  );
  for (const expected of expectedPaths(fixture)) {
    assert.ok(found.has(expected), expected);
  }
});
test("finds each feature by its documented minimum level", async () => {
  const results = await Promise.all(
    fixture.cases.map((item) =>
      findExistingPaths(item.text, item.level, fixture.directories, fixture.variables, false, true),
    ),
  );
  for (const [index, item] of fixture.cases.entries()) {
    const found = new Set(results[index]);
    for (const relative of item.expected) {
      assert.ok(found.has(fixture.pathFor(relative)), item.feature);
    }
  }
});
test("returns files and directories but excludes missing paths", async () => {
  const found = await findExistingPaths(
    "Try package.json, missing.txt, and src.",
    MAX_LEVEL,
    fixture.directories,
    {},
    false,
    true,
  );
  assert.deepEqual(
    new Set(found),
    new Set([fixture.pathFor("package.json"), fixture.pathFor("src")]),
  );
});
test("uses additional variables", async () => {
  const text = "Load %PROJECT_ROOT%/config/.env.local.";
  const withoutVariables = await findExistingPaths(text, 2, fixture.directories, {}, false, true);
  const withVariables = await findExistingPaths(
    text,
    2,
    fixture.directories,
    fixture.variables,
    false,
    true,
  );
  assert.deepEqual(withoutVariables, []);
  assert.deepEqual(withVariables, [fixture.pathFor("config/.env.local")]);
});
test("prefers additional variables over environment variables", async () => {
  const previous = process.env.PROJECT_ROOT;
  process.env.PROJECT_ROOT = fixture.secondary;
  try {
    const found = await findExistingPaths(
      "Load $env:PROJECT_ROOT/config/.env.local.",
      2,
      fixture.directories,
      fixture.variables,
      false,
      true,
    );
    assert.deepEqual(found, [fixture.pathFor("config/.env.local")]);
  } finally {
    if (previous === undefined) {
      delete process.env.PROJECT_ROOT;
    } else {
      process.env.PROJECT_ROOT = previous;
    }
  }
});
test("controls ignore rules", async () => {
  const text = fixture.ignoredPaths.join(", ");
  const previousConfig = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = fixture.globalConfig;
  try {
    const respected = await findExistingPaths(
      `${text}, package.json, src/index.ts, ./src`,
      2,
      fixture.directories,
      {},
      true,
      true,
    );
    const disabled = await findExistingPaths(text, 2, fixture.directories, {}, false, true);
    assert.deepEqual(
      new Set(respected),
      new Set([
        fixture.pathFor("package.json"),
        fixture.pathFor("src/index.ts"),
        fixture.pathFor("src"),
      ]),
    );
    assert.deepEqual(new Set(disabled), new Set(fixture.ignoredPaths.map(fixture.pathFor)));
  } finally {
    if (previousConfig === undefined) {
      delete process.env.GIT_CONFIG_GLOBAL;
    } else {
      process.env.GIT_CONFIG_GLOBAL = previousConfig;
    }
  }
});
test("controls hidden paths", async () => {
  const text = fixture.hiddenPaths.join(", ");
  const hidden = await findExistingPaths(text, 2, fixture.directories, {}, false, false);
  const visible = await findExistingPaths(text, 2, fixture.directories, {}, false, true);
  assert.deepEqual(hidden, []);
  assert.deepEqual(new Set(visible), new Set(fixture.hiddenPaths.map(fixture.pathFor)));
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
test("restricts absolute paths to the search directories", async () => {
  const found = await findExistingPaths(
    `"${fixture.root}"`,
    1,
    fixture.directories,
    {},
    false,
    true,
  );
  assert.deepEqual(found, []);
});
test("restricts relative paths to the search directories", async () => {
  const relative = nodePath.relative(fixture.primary, fixture.root);
  const found = await findExistingPaths(
    `"${nodePath.join(relative, "global.ignore")}"`,
    1,
    fixture.directories,
    {},
    false,
    true,
  );
  assert.deepEqual(found, []);
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
  assert.deepEqual(found, [fixture.primary]);
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
