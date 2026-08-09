import { Bench } from "tinybench";
import { Buffer } from "node:buffer";
import os from "node:os";
import { findExistingPaths, MAX_LEVEL } from "../../dist/index.mjs";
import { benchmarkSettings } from "../../config/benchmark.mjs";
import { createDistractorText } from "./cases/distractors.mjs";
import { createFixture } from "./fixture.mjs";
import { createBenchmarkDocument, scoreMatches } from "./score.mjs";

const fixture = await createFixture({
  noiseFilesPerRoot: benchmarkSettings.noiseFilesPerRoot,
  writeConcurrency: benchmarkSettings.writeConcurrency,
});
try {
  const document = createBenchmarkDocument(
    fixture.cases,
    createDistractorText(benchmarkSettings.distractorParagraphs),
    fixture.pathFor,
  );
  const find = (level) =>
    findExistingPaths({
      directories: fixture.directories,
      level,
      respectIgnore: false,
      searchHidden: true,
      text: document.text,
      variables: fixture.variables,
    });
  const bench = new Bench({
    iterations: benchmarkSettings.iterations,
    time: benchmarkSettings.timeMilliseconds,
    warmup: true,
    warmupIterations: benchmarkSettings.warmupIterations,
  });

  for (let level = 1; level <= MAX_LEVEL; level += 1) {
    bench.add(`level ${level}`, async () => {
      await find(level);
    });
  }

  await bench.run();
  const measured = await Promise.all(
    Array.from({ length: MAX_LEVEL }, (_, index) => find(index + 1)),
  );
  const rows = bench.tasks.map((task, index) => {
    const score = scoreMatches(measured[index] ?? [], document.segments);
    score.level = Number(task.name.slice("level ".length));
    score.meanMs = Number(task.result?.latency.mean.toFixed(3));
    score.medianMs = Number(task.result?.latency.p50.toFixed(3));
    return score;
  });
  console.table(
    rows.map(({ categories, ...row }) => ({
      ...row,
      categories: Object.keys(categories).length,
    })),
  );
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
          ...document.summary,
          textBytes: Buffer.byteLength(document.text),
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
} finally {
  await fixture.cleanup();
}
