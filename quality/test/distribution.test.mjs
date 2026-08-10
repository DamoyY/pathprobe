import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import nodePath from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url)));
const entryUrl = new URL("../../dist/index.mjs", import.meta.url);
const bridgeUrl = new URL("../../dist/native/windows-bridge.cjs", import.meta.url);
test("publishes the native bridge as a private CJS dependency", async () => {
  assert.equal(packageJson.exports["./native-loader"], undefined);
  assert.equal(packageJson.engines.bun, ">=1.2.6");
  assert.equal(packageJson.engines.node, ">=20.16.0");
  assert.equal(typeof packageJson.dependencies.koffi, "string");
  assert.ok(packageJson.files.includes("dist"));
  const bridge = await readFile(bridgeUrl, "utf8");
  assert.match(bridge, /require\(["']koffi["']\)/u);
  assert.match(bridge, /module\.exports\s*=\s*\{\s*getDriveConnection,\s*getFileAttributes\s*\}/u);
});
test("exposes the native bridge to downstream bundlers as a static dependency", async () => {
  const entry = await readFile(entryUrl, "utf8");
  const packageApi = await import("pathprobe");
  assert.equal(typeof packageApi.findExistingPaths, "function");
  assert.match(entry, /^import\s+nativeBridge\s+from\s+["']\.\/native\/windows-bridge\.cjs["'];/mu);
  assert.doesNotMatch(entry, /pathprobe\/native-loader/u);
  assert.doesNotMatch(entry, /["']koffi["']/u);
  assert.doesNotMatch(entry, /@koromix\/koffi-/u);
});
test("exposes only the required native operations", () => {
  const native = createRequire(import.meta.url)(fileURLToPath(bridgeUrl));
  assert.deepEqual(Object.keys(native), ["getDriveConnection", "getFileAttributes"]);
  assert.equal(typeof native.getDriveConnection, "function");
  assert.equal(typeof native.getFileAttributes, "function");
});
test("resolves Koffi from the bridge's dependency directory", async () => {
  const temporaryRoot = await mkdtemp(nodePath.join(tmpdir(), "pathprobe-native-"));
  const loaderPath = nodePath.join(temporaryRoot, "windows-bridge.cjs");
  const koffiPath = nodePath.join(temporaryRoot, "node_modules", "koffi");
  await mkdir(koffiPath, { recursive: true });
  await copyFile(bridgeUrl, loaderPath);
  await writeFile(
    nodePath.join(koffiPath, "index.js"),
    [
      "module.exports = {",
      "  decode(buffer, type, length) {",
      '    if (type !== "char16_t" || length !== 16) throw new Error("unexpected decode");',
      '    return "remote";',
      "  },",
      "  load(library) {",
      "    return {",
      "      func(signature) {",
      '        if (library === "mpr.dll" && signature.includes("WNetGetConnectionW")) return () => 0;',
      '        if (library === "kernel32.dll" && signature.includes("GetFileAttributesW")) return () => 2;',
      '        if (library === "kernel32.dll" && signature.includes("GetLastError")) return () => 0;',
      '        throw new Error("unexpected native function");',
      "      },",
      "    };",
      "  },",
      "};",
      "",
    ].join("\n"),
  );
  try {
    const native = createRequire(loaderPath)(loaderPath);
    assert.deepEqual(Object.keys(native), ["getDriveConnection", "getFileAttributes"]);
    assert.deepEqual(native.getDriveConnection("Z:", 16), {
      remote: "remote",
      status: 0,
    });
    assert.deepEqual(native.getFileAttributes("C:\\visible.txt"), {
      attributes: 2,
      error: 0,
    });
  } finally {
    await rm(temporaryRoot, { recursive: true });
  }
});
test(
  "runs after downstream Bun single-file compilation",
  { skip: typeof globalThis.Bun?.version !== "string", timeout: 30_000 },
  async () => {
    const downstreamRoot = await mkdtemp(
      nodePath.join(fileURLToPath(new URL("../../", import.meta.url)), ".downstream-"),
    );
    const runtimeRoot = await mkdtemp(nodePath.join(tmpdir(), "pathprobe-compile-"));
    const downstreamEntry = nodePath.join(downstreamRoot, "entry.mjs");
    const executablePath = nodePath.join(
      runtimeRoot,
      process.platform === "win32" ? "pathprobe.exe" : "pathprobe",
    );
    try {
      const entrySpecifier = `./${nodePath
        .relative(downstreamRoot, fileURLToPath(entryUrl))
        .replaceAll(nodePath.sep, "/")}`;
      await writeFile(
        downstreamEntry,
        [
          `import { findExistingPaths } from ${JSON.stringify(entrySpecifier)};`,
          `await findExistingPaths({ directories: [process.cwd()], level: 1, text: ${JSON.stringify("\\\\pathprobe.invalid\\share\\missing")} });`,
          "",
        ].join("\n"),
      );
      const compiled = spawnSync(
        process.execPath,
        ["build", downstreamEntry, "--compile", `--outfile=${executablePath}`],
        { encoding: "utf8", windowsHide: true },
      );
      assert.equal(compiled.status, 0, `${compiled.stdout}\n${compiled.stderr}`);
      await rm(downstreamEntry);
      const executed = spawnSync(executablePath, [], {
        cwd: runtimeRoot,
        encoding: "utf8",
        windowsHide: true,
      });
      assert.equal(executed.status, 0, `${executed.stdout}\n${executed.stderr}`);
    } finally {
      await Promise.all([
        rm(downstreamRoot, { recursive: true }),
        rm(runtimeRoot, { recursive: true }),
      ]);
    }
  },
);
