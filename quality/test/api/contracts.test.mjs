import assert from "node:assert/strict";
import process from "node:process";
import { after, before, test } from "node:test";
import { MAX_LEVEL, findExistingPaths } from "../../../dist/index.mjs";
import { createFixture } from "../../benchmark/fixture.mjs";

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
  fixture = await createFixture();
});
after(async () => {
  await fixture.cleanup();
});
void test("returns files and directories but excludes missing paths", async () => {
  const text = "Try package.json, missing.txt, and src/.",
    found = await find(text, MAX_LEVEL);
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
        text.slice(match.position.start, match.position.end) === "src/",
    ),
  );
  assert.ok(found.every((match) => match.path !== fixture.pathFor("missing.txt")));
});
void test("does not recognize standalone dots with or without quotes", async () => {
  assert.deepEqual(await find(`. "." '.' \`.\``, MAX_LEVEL), []);
});
void test("preserves repeated path occurrences", async () => {
  const text = "package.json then package.json",
    found = await find(text, 2);
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
void test("uses additional variables", async () => {
  const text = "Load %PROJECT_ROOT%/config/.env.local.",
    withoutVariables = await find(text, 2),
    withVariables = await find(text, 2, { variables: fixture.variables });
  assert.deepEqual(withoutVariables, []);
  assert.deepEqual(
    withVariables.map((match) => match.path),
    [fixture.pathFor("config/.env.local")],
  );
});
void test("keeps the longest nested path at each occurrence", async () => {
  const reference = "${PROJECT_ROOT}/config/.env.local",
    text = `${reference} then ${reference}`,
    found = await find(text, 2, { variables: fixture.variables });
  assert.deepEqual(
    found.map((match) => ({
      path: match.path,
      text: text.slice(match.position.start, match.position.end),
    })),
    [
      { path: fixture.pathFor("config/.env.local"), text: reference },
      { path: fixture.pathFor("config/.env.local"), text: reference },
    ],
  );
});
void test("prefers additional variables over environment variables", async () => {
  const previous = process.env.PROJECT_ROOT;
  process.env.PROJECT_ROOT = fixture.secondary;
  try {
    const found = await find("Load $env:PROJECT_ROOT/config/.env.local.", 2, {
      variables: fixture.variables,
    });
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
void test("controls ignore rules", async () => {
  const text = fixture.ignoredPaths.join(", "),
    previousConfig = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = fixture.globalConfig;
  try {
    const respected = await find(`${text}, package.json, src/index.ts, ./src`, 2, {
        respectIgnore: true,
      }),
      disabled = await find(text, 2);
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
void test("controls hidden paths", async () => {
  const text = fixture.hiddenPaths.join(", "),
    hidden = await find(text, 2, { searchHidden: false }),
    visible = await find(text, 2);
  assert.deepEqual(hidden, []);
  assert.deepEqual(
    new Set(visible.map((match) => match.path)),
    new Set(fixture.hiddenPaths.map(fixture.pathFor)),
  );
});
void test(
  "treats dot-prefixed paths as visible on Windows",
  { skip: process.platform !== "win32" },
  async () => {
    const text = fixture.dotPaths.join(", "),
      found = await find(text, 2, { searchHidden: false });
    assert.deepEqual(
      new Set(found.map((match) => match.path)),
      new Set(fixture.dotPaths.map(fixture.pathFor)),
    );
  },
);
