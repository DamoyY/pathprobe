import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  copy: {
    flatten: false,
    from: "src/native/windows-bridge.cjs",
  },
  cwd: process.cwd(),
  dts: false,
  entry: "src/index.ts",
  format: "esm",
  inputOptions: {
    external: /(?:^|[\\/])windows-bridge\.cjs$/u,
  },
  platform: "node",
  sourcemap: true,
  tsconfig: "tsconfig.json",
});
