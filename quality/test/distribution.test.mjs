import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import nodePath from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url)));
const entryUrl = new URL("../../dist/index.mjs", import.meta.url);
test("publishes the native loader as a require-only subpath", async () => {
  assert.deepEqual(packageJson.exports["./native-loader"], {
    require: "./dist/native-loader.cjs",
  });
  assert.equal(packageJson.engines.bun, ">=1.2.6");
  assert.equal(packageJson.engines.node, ">=20.16.0");
  assert.equal(typeof packageJson.dependencies.koffi, "string");
  assert.ok(packageJson.files.includes("dist"));
  const loaderUrl = new URL("../../dist/native-loader.cjs", import.meta.url);
  assert.equal(
    createRequire(import.meta.url).resolve("pathprobe/native-loader"),
    fileURLToPath(loaderUrl),
  );
  const loader = await readFile(loaderUrl, "utf8");
  assert.match(loader, /require\(["']koffi["']\)/u);
  assert.match(loader, /module\.exports\s*=\s*\{\s*getDriveConnection\s*\}/u);
});
test("loads the native bridge through the runtime package subpath", async () => {
  const entry = await readFile(entryUrl, "utf8");
  const packageApi = await import("pathprobe");
  assert.equal(typeof packageApi.findExistingPaths, "function");
  assert.match(entry, /globalThis\.process\.getBuiltinModule\(["']node:module["']\)/u);
  assert.match(entry, /runtimeRequire\(["']pathprobe\/native-loader["']\)/u);
  assert.doesNotMatch(entry, /^\s*import\b[^\n;]*["']pathprobe\/native-loader["']/mu);
  assert.doesNotMatch(entry, /import\(["']pathprobe\/native-loader["']\)/u);
  assert.doesNotMatch(entry, /["']koffi["']/u);
  assert.doesNotMatch(entry, /@koromix\/koffi-/u);
});
test("exposes only the required native operation", { skip: process.platform !== "win32" }, () => {
  const runtimeRequire = createRequire(import.meta.url);
  const native = runtimeRequire("pathprobe/native-loader");
  assert.deepEqual(Object.keys(native), ["getDriveConnection"]);
  assert.equal(typeof native.getDriveConnection, "function");
});
test("resolves Koffi from the bridge's dependency directory", async () => {
  const temporaryRoot = await mkdtemp(nodePath.join(tmpdir(), "pathprobe-native-"));
  const loaderPath = nodePath.join(temporaryRoot, "native-loader.cjs");
  const koffiPath = nodePath.join(temporaryRoot, "node_modules", "koffi");
  await mkdir(koffiPath, { recursive: true });
  await copyFile(new URL("../../dist/native-loader.cjs", import.meta.url), loaderPath);
  await writeFile(
    nodePath.join(koffiPath, "index.js"),
    [
      "module.exports = {",
      "  decode(buffer, type, length) {",
      '    if (type !== "char16_t" || length !== 16) throw new Error("unexpected decode");',
      '    return "remote";',
      "  },",
      "  load(library) {",
      '    if (library !== "mpr.dll") throw new Error("unexpected library");',
      "    return {",
      "      func(signature) {",
      '        if (!signature.includes("WNetGetConnectionW")) throw new Error("unexpected signature");',
      "        return () => 0;",
      "      },",
      "    };",
      "  },",
      "};",
      "",
    ].join("\n"),
  );
  try {
    const native = createRequire(loaderPath)(loaderPath);
    assert.deepEqual(Object.keys(native), ["getDriveConnection"]);
    assert.deepEqual(native.getDriveConnection("Z:", 16), {
      remote: "remote",
      status: 0,
    });
  } finally {
    await rm(temporaryRoot, { recursive: true });
  }
});
test(
  "keeps Koffi out of a downstream Bun bundle",
  { skip: typeof globalThis.Bun?.build !== "function" },
  async () => {
    const result = await globalThis.Bun.build({
      entrypoints: [fileURLToPath(entryUrl)],
      packages: "bundle",
      target: "node",
      write: false,
    });
    assert.equal(result.success, true, result.logs.join("\n"));
    const output = await result.outputs[0].text();
    assert.match(output, /runtimeRequire\(["']pathprobe\/native-loader["']\)/u);
    assert.doesNotMatch(output, /@koromix\/koffi-|import\.meta\.dirname|node_modules\/koffi/u);

    const bundleRoot = await mkdtemp(
      nodePath.join(fileURLToPath(new URL("../../", import.meta.url)), ".downstream-"),
    );
    const bundlePath = nodePath.join(bundleRoot, "bundle.mjs");
    await writeFile(bundlePath, output);
    try {
      const bundledPathprobe = await import(`${pathToFileURL(bundlePath).href}?test=${Date.now()}`);
      assert.equal(typeof bundledPathprobe.findExistingPaths, "function");
    } finally {
      await rm(bundleRoot, { recursive: true });
    }
  },
);
