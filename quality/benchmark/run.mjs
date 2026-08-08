import { Bench } from "tinybench";
import { Buffer } from "node:buffer";
import os from "node:os";
import { findExistingPaths, MAX_LEVEL } from "../../dist/index.mjs";
import { benchmarkSettings } from "../../config/benchmark.mjs";
import { createDistractorText } from "./cases/distractors.mjs";
import { createFixture } from "./fixture.mjs";

const fixture = await createFixture({
  noiseFilesPerRoot: benchmarkSettings.noiseFilesPerRoot,
  writeConcurrency: benchmarkSettings.writeConcurrency,
});
const caseText = fixture.cases.map((item) => item.text).join("\n");
const text = `${caseText}\n${createDistractorText(benchmarkSettings.distractorParagraphs)}`;
const find = (input, level) =>
  findExistingPaths(input, level, fixture.directories, fixture.variables, false, true);
const bench = new Bench({
  iterations: benchmarkSettings.iterations,
  time: benchmarkSettings.timeMilliseconds,
  warmup: true,
  warmupIterations: benchmarkSettings.warmupIterations,
});

for (let level = 1; level <= MAX_LEVEL; level += 1) {
  bench.add(`level ${level}`, async () => {
    await find(text, level);
  });
}

await bench.run();

const measured = await Promise.all(
  Array.from({ length: MAX_LEVEL }, (_, index) => find(text, index + 1)),
);
const expected = new Set(
  fixture.cases.flatMap((item) => item.expected.map((relative) => fixture.pathFor(relative))),
);
const total = fixture.cases.reduce((sum, item) => sum + item.expected.length, 0);

const rows = bench.tasks.map((task, index) => {
  const level = Number(task.name.slice("level ".length));
  const found = new Set((measured[index] ?? []).map((match) => match.path));
  let matched = 0;
  let completedCases = 0;
  for (const item of fixture.cases) {
    const expectedForCase = item.expected.map((relative) => fixture.pathFor(relative));
    const caseMatches = [...expectedForCase].filter((filePath) => found.has(filePath)).length;
    matched += caseMatches;
    completedCases += Number(caseMatches === expectedForCase.length);
  }
  return {
    level,
    meanMs: Number(task.result?.latency.mean.toFixed(3)),
    medianMs: Number(task.result?.latency.p50.toFixed(3)),
    found: matched,
    total,
    completionRate: Number((matched / total).toFixed(3)),
    completedCases,
    falsePositives: [...found].filter((filePath) => !expected.has(filePath)).length,
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
      fixture: {
        ...fixture.stats,
        pathExpectations: total,
        scenarios: fixture.cases.length,
        textBytes: Buffer.byteLength(text),
      },
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
