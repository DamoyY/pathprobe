export const edgeFiles = [
  "src/index.ts.bak",
  "design/(approved)/spec.md",
  "commands/build;release.cmd",
  "versions/v1.2.3/notes",
  "literal/plus+sign.txt",
  "api/v2/accounts",
  "2026/08/08",
  "3.14.159",
  "127.0.0.1",
  "com.example.Service",
];
export function createEdgeCases({ nativeRelative }) {
  return [
    {
      expected: ["src/index.ts"],
      feature: "whole-input",
      level: 2,
      text: "src/index.ts",
    },
    {
      expected: ["src/index.ts"],
      feature: "surrounding-parentheses",
      level: 1,
      text: "Failure while reading (./src/index.ts).",
    },
    {
      expected: ["apps/api/server.ts", "packages/core/src/parser.ts"],
      feature: "mixed-whitespace",
      level: 2,
      text: "apps/api/server.ts\tpackages/core/src/parser.ts\r\n",
    },
    {
      expected: ["services/auth/config.production.json"],
      feature: "native-separators",
      level: 2,
      text: `Open ${nativeRelative} before startup.`,
    },
    {
      expected: ["src/index.ts.bak"],
      feature: "shared-path-prefix",
      level: 2,
      text: "Restore src/index.ts.bak only; keep the source unchanged.",
    },
    {
      expected: ["src/index.ts", "src/index.ts"],
      feature: "repeated-occurrence",
      level: 2,
      text: "Compare src/index.ts against src/index.ts.",
    },
    {
      expected: ["src/index.ts"],
      feature: "quoted-location",
      level: 1,
      text: 'The diagnostic points to "src/index.ts:31:9".',
    },
    {
      expected: ["design/(approved)/spec.md"],
      feature: "parentheses-in-filename",
      level: 5,
      text: "Review design/(approved)/spec.md before fabrication.",
    },
    {
      expected: ["commands/build;release.cmd"],
      feature: "semicolon-in-filename",
      level: 5,
      text: "Run commands/build;release.cmd after signing.",
    },
    {
      expected: ["versions/v1.2.3/notes"],
      feature: "version-directory",
      level: 2,
      text: "Publish versions/v1.2.3/notes with the tag.",
    },
    {
      expected: ["literal/plus+sign.txt"],
      feature: "plus-character",
      level: 2,
      text: "Read literal/plus+sign.txt exactly once.",
    },
  ];
}
