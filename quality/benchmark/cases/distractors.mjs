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
  {
    expected: [],
    feature: "relative-http-route",
    level: 1,
    text: "The reverse proxy forwarded GET api/v2/accounts successfully.",
  },
  {
    expected: [],
    feature: "version-file-collision",
    level: 1,
    text: "Version 3.14.159 is deployed in production.",
  },
  {
    expected: [],
    feature: "date-file-collision",
    level: 1,
    text: "The maintenance window starts on 2026/08/08.",
  },
  {
    expected: [],
    feature: "ip-file-collision",
    level: 1,
    text: "The service listens on 127.0.0.1 during development.",
  },
  {
    expected: [],
    feature: "dotted-identifier-collision",
    level: 1,
    text: "Instantiate com.example.Service through the container.",
  },
];
export function createDistractorText(paragraphs) {
  return Array.from({ length: paragraphs }, (_, index) => {
    const shard = String(index % 97).padStart(2, "0"),
      lines = [
        `2026-08-08T12:${shard}:00.000Z INFO request=${index} method=GET route=/api/v${index % 4}/tenants/${shard}/events status=200`,
        `at async handler (src/generated/shard-${shard}/worker-${index}.ts:${index + 10}:7)`,
        `WARN no artifact at ./missing/session-${shard}/artifact-${index}.json`,
        `npm notice @example/module-${shard}@${index % 10}.${index % 7}.${index % 5} remained remote`,
        `Build ${20_260_000 + index} finished in ${index % 60}.${index % 1000}s; docs=https://example.invalid/builds/${index}.html`,
      ];
    return lines.join(index % 3 === 0 ? "\r\n" : "\n");
  }).join("\n");
}
