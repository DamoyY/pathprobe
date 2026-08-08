import assert from "node:assert/strict";
import { test } from "node:test";
import { createBenchmarkDocument, scoreMatches } from "../benchmark/score.mjs";

function match(path, start, end) {
  return {
    kind: "file",
    path,
    position: { end, start },
  };
}
test("does not credit a path found in a different scenario", () => {
  const document = createBenchmarkDocument(
    [
      { category: "a", expected: ["same"], feature: "first", text: "same" },
      { category: "b", expected: ["same"], feature: "second", text: "same" },
    ],
    "noise",
    (value) => value,
  );
  const score = scoreMatches([match("same", 0, 4)], document.segments);
  assert.equal(score.matched, 1);
  assert.equal(score.total, 2);
  assert.equal(score.recall, 0.5);
  assert.equal(score.passedScenarios, 2);
});
test("counts repeated path expectations by occurrence", () => {
  const document = createBenchmarkDocument(
    [
      {
        category: "edge",
        expected: ["same", "same"],
        feature: "repeat",
        text: "same same",
      },
    ],
    "",
    (value) => value,
  );
  const incomplete = scoreMatches([match("same", 0, 4)], document.segments);
  const complete = scoreMatches([match("same", 0, 4), match("same", 5, 9)], document.segments);
  assert.equal(incomplete.matched, 1);
  assert.equal(incomplete.scenarioPassRate, 0.5);
  assert.equal(complete.matched, 2);
  assert.equal(complete.scenarioPassRate, 1);
});
test("treats matches in negative scenarios as false positives", () => {
  const document = createBenchmarkDocument(
    [{ category: "adversarial", expected: [], feature: "route", text: "api/v1" }],
    "",
    (value) => value,
  );
  const score = scoreMatches([match("api/v1", 0, 6)], document.segments);
  assert.equal(score.falsePositives, 1);
  assert.equal(score.precision, 0);
  assert.equal(score.categories.adversarial.scenarioPassRate, 0);
});
