export const workloadFiles = [
  "tests/e2e/auth flow.spec.ts",
  "deploy/kubernetes/api deployment.yaml",
  "build/manifests/assets.json",
  "workers/image processor/index.js",
  "coverage/lcov-report/index.html",
];
export function createWorkloadCases({ absolute, absoluteFileUrl, escapedAbsolute, spacedFileUrl }) {
  return [
    {
      expected: ["apps/api/server.ts", "src/components/Primary Button.tsx"],
      feature: "typescript-diagnostics",
      level: 3,
      text: [
        "apps/api/server.ts:48:17 - error TS2345: Argument is not assignable.",
        "src/components/Primary Button.tsx:9:3 - error TS6133: 'label' is never read.",
      ].join("\n"),
    },
    {
      expected: ["src/index.ts", "src/index.ts"],
      feature: "node-stack-trace",
      level: 1,
      text: [
        "TypeError: Cannot read properties of undefined",
        `    at bootstrap (${absolute}:18:4)`,
        `    at async main (${absoluteFileUrl}:31:9)`,
      ].join("\n"),
    },
    {
      expected: ["apps/api/server.ts", "apps/web/vite.config.ts", "packages/core/src/parser.ts"],
      feature: "git-status",
      level: 2,
      text: [
        "Changes not staged for commit:",
        "  modified:   apps/api/server.ts",
        "  modified:   apps/web/vite.config.ts",
        "  modified:   packages/core/src/parser.ts",
      ].join("\n"),
    },
    {
      expected: ["tools/scripts/release candidate", "services/auth/config.production.json"],
      feature: "shell-session",
      level: 2,
      text: [
        '$ node "tools/scripts/release candidate" --dry-run',
        "$ bun services/auth/config.production.json",
        "Process exited with code 1.",
      ].join("\n"),
    },
    {
      expected: ["tests/e2e/auth flow.spec.ts", "deploy/kubernetes/api deployment.yaml"],
      feature: "ci-job-log",
      level: 3,
      text: [
        "Run bun test tests/e2e/auth flow.spec.ts",
        'Uploading artifact "deploy/kubernetes/api deployment.yaml"',
        "Error: Process completed with exit code 1.",
      ].join("\n"),
    },
    {
      expected: ["src/index.ts"],
      feature: "structured-json-log",
      level: 1,
      text: `{"level":"error","source":"${escapedAbsolute}","line":31,"column":9}`,
    },
    {
      expected: ["docs/guides/getting started.md", "packages/core/src/parser.ts"],
      feature: "markdown-review",
      level: 2,
      text: [
        "The onboarding steps in `docs/guides/getting started.md` are stale.",
        "Please align packages/core/src/parser.ts with the example.",
      ].join("\n\n"),
    },
    {
      expected: ["tests/e2e/auth flow.spec.ts", "coverage/lcov-report/index.html"],
      feature: "test-runner-output",
      level: 3,
      text: [
        "FAIL tests/e2e/auth flow.spec.ts",
        "Coverage report written to coverage/lcov-report/index.html.",
      ].join("\r\n"),
    },
    {
      expected: [
        "build/manifests/assets.json",
        "workers/image processor/index.js",
        "assets/icons/logo.final.svg",
      ],
      feature: "build-manifest",
      level: 1,
      text: [
        '{ "manifest": "build/manifests/assets.json",',
        '  "entry": "workers/image processor/index.js",',
        '  "icon": "assets/icons/logo.final.svg" }',
      ].join("\n"),
    },
    {
      expected: ["reports/quarterly report 2026.txt"],
      feature: "file-url-query",
      level: 1,
      text: `GET ${spacedFileUrl}?download=1#page=2 HTTP/1.1`,
    },
  ];
}
