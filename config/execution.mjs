export const runtimeProfiles = {
  node: {
    run: [],
    test: ["--test"],
  },
  bun: {
    run: ["run"],
    test: ["test"],
    compile: ["build", "{entry}", "--compile", "--outfile", "{output}"],
  },
  deno: {
    run: ["run", "--allow-all", "--node-modules-dir=manual"],
    test: ["test", "--allow-all", "--node-modules-dir=manual", "--no-check"],
  },
};
export const developmentTasks = {
  format: [
    {
      package: "oxfmt",
      binary: "../bin/oxfmt",
      arguments: ["--config", "config/tools/formatting.json"],
    },
  ],
  lint: [
    {
      package: "oxlint",
      binary: "../bin/oxlint",
      arguments: [
        "--config",
        "config/tools/analysis.json",
        "--tsconfig",
        "config/tools/typescript.json",
        "--deny-warnings",
      ],
    },
    {
      package: "knip",
      binary: "../bin/knip.js",
      arguments: ["--config", "config/tools/reachability.json"],
    },
  ],
};
