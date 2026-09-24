import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { MAX_LEVEL, findExistingPaths } from "../../../dist/index.mjs";
import { createFixture } from "../../benchmark/fixture.mjs";

let fixture;
function find(text, level) {
  return findExistingPaths({
    directories: fixture.directories,
    level,
    respectIgnore: false,
    searchHidden: true,
    text,
    variables: fixture.variables,
  });
}
before(async () => {
  fixture = await createFixture();
});
after(async () => {
  await fixture.cleanup();
});
void test("returns locations and merges matches by path and position", async () => {
  const text = "src/index.ts:12:4",
    found = await find(text, MAX_LEVEL);
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
void test("returns line-only locations for explicit and quoted references", async () => {
  const references = [
      { level: 2, line: 18, pathEnd: 14, text: "./src/index.ts:18", textStart: 0 },
      { level: 1, line: 9, pathEnd: 13, text: '"src/index.ts:9"', textStart: 1 },
    ],
    results = await Promise.all(
      references.map((reference) => find(reference.text, reference.level)),
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
void test("returns hash line locations with path-only positions across search levels", async () => {
  const references = [
    { level: 2, path: "src/service/operation/apply/batch.rs" },
    { level: 1, path: "./src/index.ts" },
    { level: 1, path: "src/index.ts", quoted: true },
    { level: 1, path: fixture.pathFor("src/index.ts") },
    { level: 2, path: "package.json" },
    { level: 2, path: "$PROJECT_ROOT/src/index.ts", resolved: "src/index.ts" },
    { level: 1, path: "reports/quarterly report 2026.txt", quoted: true },
    { level: 3, path: "reports/quarterly report 2026.txt" },
    { level: 2, path: "hash#tag.md" },
  ];
  await Promise.all(
    references.flatMap((reference) => {
      const value = `${reference.path}#L95`,
        text = `Open ${reference.quoted ? `"${value}"` : value}.`,
        start = text.indexOf(reference.path);
      return Array.from({ length: MAX_LEVEL - reference.level + 1 }, async (_, index) => {
        const level = reference.level + index;
        assert.deepEqual(
          await find(text, level),
          [
            {
              kind: "file",
              location: { line: 95 },
              path: fixture.pathFor(reference.resolved ?? reference.path),
              position: { end: start + reference.path.length, start },
            },
          ],
          `${text} (level ${level})`,
        );
      });
    }),
  );
});
void test("preserves hash characters that are part of the filename", async () => {
  const text = "hash#tag.md";
  assert.deepEqual(await find(text, 2), [
    {
      kind: "file",
      path: fixture.pathFor(text),
      position: { end: text.length, start: 0 },
    },
  ]);
});
