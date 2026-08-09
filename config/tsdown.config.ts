import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  copy: {
    from: "src/native/loader.cjs",
    rename: "native-loader.cjs",
  },
  cwd: process.cwd(),
  deps: {
    neverBundle: ["koffi"],
  },
  dts: false,
  entry: "src/index.ts",
  format: "esm",
  platform: "node",
  sourcemap: true,
  tsconfig: "tsconfig.json",
});
