import { countPaths } from "./path-counts.mjs";

function ratio(numerator, denominator) {
  return denominator === 0 ? 1 : Number((numerator / denominator).toFixed(3));
}
function createAccumulator() {
  return {
    falsePositives: 0,
    matched: 0,
    passedScenarios: 0,
    scenarios: 0,
    total: 0,
  };
}
function addResult(target, result) {
  target.falsePositives += result.falsePositives;
  target.matched += result.matched;
  target.passedScenarios += Number(result.passed);
  target.scenarios += 1;
  target.total += result.total;
}
function finish(result) {
  return {
    ...result,
    precision: ratio(result.matched, result.matched + result.falsePositives),
    recall: ratio(result.matched, result.total),
    scenarioPassRate: ratio(result.passedScenarios, result.scenarios),
  };
}
function scoreSegment(matches, segment) {
  const expected = countPaths(segment.expected);
  const actual = countPaths(matches.map((match) => match.path));
  let matched = 0;
  let falsePositives = 0;
  for (const [key, count] of actual) {
    matched += Math.min(count, expected.get(key) ?? 0);
    falsePositives += Math.max(0, count - (expected.get(key) ?? 0));
  }
  return {
    falsePositives,
    matched,
    passed: matched === segment.expected.length && falsePositives === 0,
    total: segment.expected.length,
  };
}
function summarize(segments) {
  const categories = {};
  let pathExpectations = 0;
  for (const segment of segments) {
    const current = categories[segment.category] ?? {
      pathExpectations: 0,
      scenarios: 0,
    };
    current.pathExpectations += segment.expected.length;
    current.scenarios += 1;
    categories[segment.category] = current;
    pathExpectations += segment.expected.length;
  }
  return { categories, pathExpectations, scenarios: segments.length };
}
export function createBenchmarkDocument(cases, backgroundText, pathFor) {
  const entries = [
    ...cases,
    {
      category: "background",
      expected: [],
      feature: "generated-operational-noise",
      text: backgroundText,
    },
  ];
  const chunks = [];
  const segments = [];
  let offset = 0;
  for (const [index, entry] of entries.entries()) {
    if (index > 0) {
      chunks.push("\n\n");
      offset += 2;
    }
    const start = offset;
    chunks.push(entry.text);
    offset += entry.text.length;
    segments.push({
      category: entry.category,
      end: offset,
      expected: entry.expected.map(pathFor),
      feature: entry.feature,
      start,
    });
  }
  return {
    segments,
    summary: summarize(segments),
    text: chunks.join(""),
  };
}
export function scoreMatches(matches, segments) {
  const matchesBySegment = segments.map(() => []);
  let unattributed = 0;
  for (const match of matches) {
    const index = segments.findIndex(
      (segment) => match.position.start >= segment.start && match.position.end <= segment.end,
    );
    if (index === -1) {
      unattributed += 1;
    } else {
      matchesBySegment[index]?.push(match);
    }
  }
  const total = createAccumulator();
  const categories = new Map();
  for (const [index, segment] of segments.entries()) {
    const result = scoreSegment(matchesBySegment[index] ?? [], segment);
    addResult(total, result);
    const category = categories.get(segment.category) ?? createAccumulator();
    addResult(category, result);
    categories.set(segment.category, category);
  }
  total.falsePositives += unattributed;
  return {
    ...finish(total),
    categories: Object.fromEntries(
      [...categories].map(([category, result]) => [category, finish(result)]),
    ),
  };
}
