import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { runtime } from "std-env";
import { runtimeProfiles } from "../../config/execution.mjs";

export const messages = JSON.parse(
  readFileSync(new URL("../../config/locales/zh-CN/tooling.json", import.meta.url), "utf8"),
);
export function describeRuntime({
  name = process.env.PATHPROBE_RUNTIME ?? runtime,
  version = process.env.PATHPROBE_RUNTIME_VERSION ?? process.versions[name],
} = {}) {
  if (typeof name !== "string" || !name.trim() || typeof version !== "string" || !version.trim()) {
    throw new Error(messages.invalidIdentity);
  }
  return { name, version };
}
export function executionProfile(name = describeRuntime().name, profiles = runtimeProfiles) {
  if (!Object.hasOwn(profiles, name)) {
    throw new Error(`${messages.unknownProfile}: ${name}`);
  }
  const profile = profiles[name];
  if (
    profile === null ||
    typeof profile !== "object" ||
    [profile.run, profile.test, ...(profile.compile === undefined ? [] : [profile.compile])].some(
      (args) => !Array.isArray(args) || args.some((arg) => typeof arg !== "string"),
    )
  ) {
    throw new TypeError(`${messages.invalidProfile}: ${name}`);
  }
  return profile;
}
export function execute(args, options = {}) {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${messages.childFailure}: ${JSON.stringify(args)} (${result.signal ?? result.status})`,
    );
  }
}
