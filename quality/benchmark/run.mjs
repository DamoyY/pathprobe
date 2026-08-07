import { Bench } from "tinybench";
import os from "node:os";
import { findExistingPaths, MAX_LEVEL } from "../../dist/index.mjs";
import { createFixture } from "./fixture.mjs";

const fixture = await createFixture();
const text = fixture.cases.map((item) => item.text).join("\n");
const find = (input, level) =>
  findExistingPaths(input, level, fixture.directories, fixture.variables, false, true);
const bench = new Bench({
  iterations: 5,
  time: 250,
  warmup: true,
  warmupIterations: 1,
});

for (let level = 1; level <= MAX_LEVEL; level += 1) {
  bench.add(`level ${level}`, async () => {
    await find(text, level);
  });
}

await bench.run();

const measured = await Promise.all(
  Array.from({ length: MAX_LEVEL }, (_, index) =>
    Promise.all(fixture.cases.map((item) => find(item.text, index + 1))),
  ),
);

const rows = bench.tasks.map((task, index) => {
  const level = Number(task.name.slice("level ".length));
  const results = measured[index] ?? [];
  let matched = 0;
  let falsePositives = 0;
  let completedCases = 0;
  for (const [caseIndex, item] of fixture.cases.entries()) {
    const expectedForCase = new Set(item.expected.map((relative) => fixture.pathFor(relative)));
    const found = new Set(results[caseIndex]);
    const caseMatches = [...expectedForCase].filter((filePath) => found.has(filePath)).length;
    matched += caseMatches;
    falsePositives += [...found].filter((filePath) => !expectedForCase.has(filePath)).length;
    completedCases += Number(caseMatches === expectedForCase.size);
  }
  const total = fixture.cases.reduce((sum, item) => sum + item.expected.length, 0);
  return {
    level,
    meanMs: Number(task.result?.latency.mean.toFixed(3)),
    medianMs: Number(task.result?.latency.p50.toFixed(3)),
    found: matched,
    total,
    completionRate: Number((matched / total).toFixed(3)),
    completedCases,
    falsePositives,
  };
});

console.table(rows);
const bunVersion = globalThis.Bun?.version;
const runtime =
  bunVersion === undefined
    ? { name: "node", version: process.version }
    : { name: "bun", version: bunVersion };
console.log(
  JSON.stringify(
    {
      system: {
        architecture: process.arch,
        cpu: os.cpus()[0]?.model,
        platform: process.platform,
        runtime,
      },
      rows,
    },
    null,
    2,
  ),
);
await fixture.cleanup();
