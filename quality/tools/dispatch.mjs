import { readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import nodePath from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { developmentTasks } from "../../config/execution.mjs";
import { execute, executionProfile, messages } from "./host.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url)),
  require = createRequire(import.meta.url),
  [task, ...args] = process.argv.slice(2),
  profile = executionProfile();
function runTool(tool) {
  execute(
    [
      ...profile.run,
      nodePath.resolve(nodePath.dirname(require.resolve(tool.package)), tool.binary),
      ...tool.arguments,
      ...args,
    ],
    { cwd: root },
  );
}
switch (task) {
  case "build": {
    const { build } = await import("tsdown");
    await build({ config: nodePath.join(root, "config/tools/bundle.mjs"), cwd: root });
    break;
  }
  case "test": {
    const directory = nodePath.join(root, "quality/test"),
      tests = (await readdir(directory, { recursive: true }))
        .filter((name) => name.endsWith(".test.mjs"))
        .toSorted()
        .map((name) => nodePath.join(directory, name));
    execute([...profile.test, ...args, ...tests], { cwd: root });
    break;
  }
  case "benchmark":
    execute([...profile.run, "quality/benchmark/run.mjs", ...args], { cwd: root });
    break;
  default:
    if (!Object.hasOwn(developmentTasks, task)) {
      throw new Error(`${messages.unknownTask}: ${task}`);
    }
    for (const tool of developmentTasks[task]) {
      runTool(tool);
    }
}
