import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { findExistingPaths, MAX_LEVEL } from "../../dist/index.mjs";
import { createFixture } from "../benchmark/fixture.mjs";

let fixture;
function find(text) {
  return findExistingPaths({
    directories: fixture.directories,
    level: MAX_LEVEL,
    respectIgnore: false,
    searchHidden: true,
    text,
  });
}
before(async () => {
  fixture = await createFixture();
});
after(async () => {
  await fixture.cleanup();
});
test("matches a punctuated inventory path within an absolute path", async () => {
  const filePath = fixture.pathFor("design/(approved)/spec.md");
  const text = `Review ${filePath} before fabrication.`;
  const found = await find(text);
  assert.ok(
    found.some(
      (match) =>
        match.path === filePath &&
        match.position.start === "Review ".length &&
        match.position.end === "Review ".length + filePath.length,
    ),
  );
  assert.ok(found.every((match) => match.path !== fixture.pathFor("design")));
});
test("preserves inventory occurrences and rejects path-like affixes", async () => {
  const text = "preLICENSE LICENSE LICENSE-post LICENSE";
  const filePath = fixture.pathFor("LICENSE");
  const found = await find(text);
  assert.deepEqual(
    found.filter((match) => match.path === filePath).map((match) => match.position),
    [
      { end: 18, start: 11 },
      { end: 39, start: 32 },
    ],
  );
});
test("requires a marker for directories but not files", async () => {
  const text = "docs docs/ ./docs LICENSE";
  const found = await find(text);
  assert.deepEqual(
    found
      .filter((match) => match.path === fixture.pathFor("docs"))
      .toSorted((left, right) => left.position.start - right.position.start)
      .map((match) => ({
        kind: match.kind,
        text: text.slice(match.position.start, match.position.end),
      })),
    [
      { kind: "directory", text: "docs/" },
      { kind: "directory", text: "./docs" },
    ],
  );
  assert.ok(
    found.some(
      (match) =>
        match.kind === "file" &&
        match.path === fixture.pathFor("LICENSE") &&
        text.slice(match.position.start, match.position.end) === "LICENSE",
    ),
  );
});
test("rebuilds the inventory matcher when directory entries change", async () => {
  const text = "cache refresh target";
  const filePath = fixture.pathFor(text);
  const initialMatches = await find(text);
  assert.ok(initialMatches.every((match) => match.path !== filePath));
  await writeFile(filePath, "");
  const updatedMatches = await find(text);
  assert.ok(updatedMatches.some((match) => match.path === filePath));
});
