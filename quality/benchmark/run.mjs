import { Bench } from "tinybench";
import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { MAX_LEVEL, findExistingPaths } from "../../dist/index.mjs";
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
    ),
    find = (level) =>
      findExistingPaths({
        directories: fixture.directories,
        level,
        respectIgnore: false,
        searchHidden: true,
        text: document.text,
        variables: fixture.variables,
      }),
    bench = new Bench({
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
    ),
    rows = bench.tasks.map((task, index) => {
      const score = scoreMatches(measured[index] ?? [], document.segments);
      score.level = Number(task.name.slice("level ".length));
      score.meanMs = Number(task.result?.latency.mean.toFixed(3));
      score.medianMs = Number(task.result?.latency.p50.toFixed(3));
      return score;
    }),
    bunVersion = globalThis.Bun?.version,
    runtime =
      bunVersion === undefined
        ? { name: "node", version: process.version }
        : { name: "bun", version: bunVersion },
    baselinePath = new URL("baseline.json", import.meta.url),
    baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  if (
    typeof baseline !== "object" ||
    baseline === null ||
    typeof baseline.runs !== "object" ||
    baseline.runs === null ||
    Array.isArray(baseline.runs)
  ) {
    throw new TypeError("baseline.json must contain a runs object");
  }
  const normalizedVersion = runtime.version.startsWith("v")
      ? runtime.version
      : `v${runtime.version}`,
    runtimeKey = `${runtime.name}-${normalizedVersion}`;
  await writeFile(
    baselinePath,
    `${JSON.stringify(
      {
        fixture: {
          ...fixture.stats,
          ...document.summary,
          textBytes: Buffer.byteLength(document.text),
        },
        runs: {
          ...baseline.runs,
          [runtimeKey]: rows,
        },
        system: {
          architecture: process.arch,
          cpu: os.cpus()[0]?.model,
          platform: process.platform,
          runtime,
        },
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await fixture.cleanup();
}
