import assert from "node:assert/strict";
import { test } from "node:test";
import { createBenchmarkDocument, scoreMatches } from "../benchmark/score.mjs";
import { describeRuntime, executionProfile } from "../tools/host.mjs";

void test("accepts runtime identities outside a fixed list", () => {
  assert.deepEqual(describeRuntime({ name: "custom-engine", version: "3.2.1" }), {
    name: "custom-engine",
    version: "3.2.1",
  });
  const profile = { run: ["execute"], test: ["verify"] };
  assert.equal(executionProfile("custom-engine", { "custom-engine": profile }), profile);
});
void test("rejects unidentified runtimes instead of attributing them to another engine", () => {
  assert.throws(() => describeRuntime({ name: "", version: "1.0" }));
  assert.throws(() => describeRuntime({ name: "custom-engine", version: "" }));
  assert.throws(() => executionProfile("unregistered", {}));
  assert.throws(() => executionProfile("toString", {}));
});
function match(path, start, end) {
  return {
    kind: "file",
    path,
    position: { end, start },
  };
}
void test("does not credit a path found in a different scenario", () => {
  const document = createBenchmarkDocument(
      [
        { category: "a", expected: ["same"], feature: "first", text: "same" },
        { category: "b", expected: ["same"], feature: "second", text: "same" },
      ],
      "noise",
      (value) => value,
    ),
    score = scoreMatches([match("same", 0, 4)], document.segments);
  assert.equal(score.matched, 1);
  assert.equal(score.total, 2);
  assert.equal(score.recall, 0.5);
  assert.equal(score.passedScenarios, 2);
});
void test("counts repeated path expectations by occurrence", () => {
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
    ),
    incomplete = scoreMatches([match("same", 0, 4)], document.segments),
    complete = scoreMatches([match("same", 0, 4), match("same", 5, 9)], document.segments);
  assert.equal(incomplete.matched, 1);
  assert.equal(incomplete.scenarioPassRate, 0.5);
  assert.equal(complete.matched, 2);
  assert.equal(complete.scenarioPassRate, 1);
});
void test("treats matches in negative scenarios as false positives", () => {
  const document = createBenchmarkDocument(
      [{ category: "adversarial", expected: [], feature: "route", text: "api/v1" }],
      "",
      (value) => value,
    ),
    score = scoreMatches([match("api/v1", 0, 6)], document.segments);
  assert.equal(score.falsePositives, 1);
  assert.equal(score.precision, 0);
  assert.equal(score.categories.adversarial.scenarioPassRate, 0);
});
