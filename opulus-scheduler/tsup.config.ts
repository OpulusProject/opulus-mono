import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    server: "src/server.ts",
    runJob: "src/scripts/runJob.ts",
  },
  format: ["esm"],
  target: "es2022",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  bundle: true,
  minify: false,
  treeshake: true,
  // Resolve path aliases from tsconfig.json
  esbuildOptions(options) {
    options.alias = {
      "@": "./src",
    };
  },
  // External dependencies that shouldn't be bundled
  external: ["@opulus/core", "express", "bullmq", "ioredis", "dotenv"],
});
