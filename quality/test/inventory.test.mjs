import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { findExistingPaths, MAX_LEVEL } from "../../dist/index.mjs";
import { createFixture } from "../benchmark/fixture.mjs";

let fixture;
before(async () => {
  fixture = await createFixture();
});
after(async () => {
  await fixture.cleanup();
});
test("matches a punctuated inventory path within an absolute path", async () => {
  const filePath = fixture.pathFor("design/(approved)/spec.md");
  const text = `Review ${filePath} before fabrication.`;
  const found = await findExistingPaths(text, MAX_LEVEL, fixture.directories, {}, false, true);
  assert.ok(
    found.some(
      (match) =>
        match.path === filePath &&
        match.position.start === "Review ".length &&
        match.position.end === "Review ".length + filePath.length,
    ),
  );
});
test("preserves inventory occurrences and rejects path-like affixes", async () => {
  const text = "preartifacts artifacts artifacts-post artifacts";
  const filePath = fixture.pathFor("artifacts");
  const found = await findExistingPaths(text, MAX_LEVEL, fixture.directories, {}, false, true);
  assert.deepEqual(
    found.filter((match) => match.path === filePath).map((match) => match.position),
    [
      { end: 22, start: 13 },
      { end: 47, start: 38 },
    ],
  );
});
test("rebuilds the inventory matcher when directory entries change", async () => {
  const text = "cache refresh target";
  const filePath = fixture.pathFor(text);
  const initialMatches = await findExistingPaths(
    text,
    MAX_LEVEL,
    fixture.directories,
    {},
    false,
    true,
  );
  assert.ok(initialMatches.every((match) => match.path !== filePath));
  await writeFile(filePath, "");
  const updatedMatches = await findExistingPaths(
    text,
    MAX_LEVEL,
    fixture.directories,
    {},
    false,
    true,
  );
  assert.ok(updatedMatches.some((match) => match.path === filePath));
});
