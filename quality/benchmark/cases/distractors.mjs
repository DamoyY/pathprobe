export const distractorCases = [
  {
    expected: [],
    feature: "semantic-version",
    level: 1,
    text: "Version 3.14.159 supersedes 2.7.18 in the release notes.",
  },
  {
    expected: [],
    feature: "http-route",
    level: 1,
    text: "The client requested /api/v2/accounts but no local path was intended.",
  },
  {
    expected: [],
    feature: "calendar-date",
    level: 1,
    text: "The review is scheduled for 2026/08/08 at 09:30.",
  },
  {
    expected: [],
    feature: "missing-stack-frame",
    level: 1,
    text: "A stack frame referenced src/missing/worker.ts:42:7.",
  },
  {
    expected: [],
    feature: "package-specifier",
    level: 1,
    text: "Install @missing/example@4.2.0 for the experiment.",
  },
  {
    expected: [],
    feature: "email-address",
    level: 1,
    text: "Contact build.release@example.invalid for access.",
  },
  {
    expected: [],
    feature: "unresolved-variable",
    level: 1,
    text: "Read ${UNDEFINED_ROOT}/missing/settings.json if configured.",
  },
  {
    expected: [],
    feature: "markdown-link",
    level: 1,
    text: "See [external docs](https://example.invalid/docs/start.html).",
  },
];
export function createDistractorText(paragraphs) {
  return Array.from({ length: paragraphs }, (_, index) => {
    const shard = String(index % 97).padStart(2, "0");
    return [
      `Request ${index} handled GET /api/v${index % 4}/tenants/${shard}/events.`,
      `The trace mentioned src/generated/shard-${shard}/worker-${index}.ts:${index + 10}:7.`,
      `No file was written to ./missing/session-${shard}/artifact-${index}.json.`,
      `Package @example/module-${shard}@${index % 10}.${index % 7}.${index % 5} remained remote.`,
      `Build ${20260000 + index} completed after ${index % 60}.${index % 1000} seconds.`,
    ].join(" ");
  }).join("\n");
}
