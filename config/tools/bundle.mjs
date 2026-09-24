import { defineConfig } from "tsdown";
import process from "node:process";

export default defineConfig({
  clean: true,
  copy: {
    flatten: false,
    from: "src/native/windows-bridge.cjs",
  },
  cwd: process.cwd(),
  dts: { generator: "oxc" },
  entry: "src/index.ts",
  format: "esm",
  inputOptions: {
    external: /(?:^|[\\/])windows-bridge\.cjs$/u,
  },
  platform: "node",
  sourcemap: true,
  target: "es2023",
  tsconfig: "config/tools/typescript.json",
});
