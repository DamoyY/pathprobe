import assert from "node:assert/strict";
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
    (
      await findExistingPaths(text, MAX_LEVEL, fixture.directories, fixture.variables, false, true)
    ).map((match) => match.path),
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
    const found = new Set(results[index]?.map((match) => match.path));
    for (const relative of item.expected) {
      assert.ok(found.has(fixture.pathFor(relative)), item.feature);
    }
  }
});
test("returns files and directories but excludes missing paths", async () => {
  const text = "Try package.json, missing.txt, and src.";
  const found = await findExistingPaths(text, MAX_LEVEL, fixture.directories, {}, false, true);
  assert.ok(
    found.some(
      (match) =>
        match.path === fixture.pathFor("package.json") &&
        match.kind === "file" &&
        text.slice(match.position.start, match.position.end) === "package.json",
    ),
  );
  assert.ok(
    found.some(
      (match) =>
        match.path === fixture.pathFor("src") &&
        match.kind === "directory" &&
        text.slice(match.position.start, match.position.end) === "src",
    ),
  );
  assert.ok(found.every((match) => match.path !== fixture.pathFor("missing.txt")));
});
test("preserves repeated path occurrences", async () => {
  const text = "package.json then package.json";
  const found = await findExistingPaths(text, 2, fixture.directories, {}, false, true);
  assert.deepEqual(
    found.filter((match) => match.path === fixture.pathFor("package.json")),
    [
      {
        kind: "file",
        path: fixture.pathFor("package.json"),
        position: { end: 12, start: 0 },
      },
      {
        kind: "file",
        path: fixture.pathFor("package.json"),
        position: { end: 30, start: 18 },
      },
    ],
  );
});
test("returns locations and merges matches by path and position", async () => {
  const text = "src/index.ts:12:4";
  const found = await findExistingPaths(text, MAX_LEVEL, fixture.directories, {}, false, true);
  assert.deepEqual(
    found.filter((match) => match.path === fixture.pathFor("src/index.ts")),
    [
      {
        kind: "file",
        location: { column: 4, line: 12 },
        path: fixture.pathFor("src/index.ts"),
        position: { end: 12, start: 0 },
      },
    ],
  );
});
test("returns line-only locations for explicit and quoted references", async () => {
  const references = [
    { level: 2, line: 18, pathEnd: 14, text: "./src/index.ts:18", textStart: 0 },
    { level: 1, line: 9, pathEnd: 13, text: '"src/index.ts:9"', textStart: 1 },
  ];
  const results = await Promise.all(
    references.map((reference) =>
      findExistingPaths(reference.text, reference.level, fixture.directories, {}, false, true),
    ),
  );
  assert.deepEqual(
    results,
    references.map((reference) => [
      {
        kind: "file",
        location: { line: reference.line },
        path: fixture.pathFor("src/index.ts"),
        position: { end: reference.pathEnd, start: reference.textStart },
      },
    ]),
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
  assert.deepEqual(
    withVariables.map((match) => match.path),
    [fixture.pathFor("config/.env.local")],
  );
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
    assert.deepEqual(
      found.map((match) => match.path),
      [fixture.pathFor("config/.env.local")],
    );
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
      new Set(respected.map((match) => match.path)),
      new Set([
        fixture.pathFor("package.json"),
        fixture.pathFor("src/index.ts"),
        fixture.pathFor("src"),
      ]),
    );
    assert.deepEqual(
      new Set(disabled.map((match) => match.path)),
      new Set(fixture.ignoredPaths.map(fixture.pathFor)),
    );
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
  assert.deepEqual(
    new Set(visible.map((match) => match.path)),
    new Set(fixture.hiddenPaths.map(fixture.pathFor)),
  );
});
