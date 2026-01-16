import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "es2022",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: false,
  bundle: true,
  minify: false,
  treeshake: true,
  // Inject crypto polyfill at the top of the bundle (before any imports)
  banner: {
    js: `import { webcrypto } from "node:crypto"; if (typeof globalThis.crypto === "undefined") { globalThis.crypto = webcrypto; }`,
  },
  // Resolve path aliases from tsconfig.json
  esbuildOptions(options) {
    options.alias = {
      "@": "./src",
    };
  },
  // External dependencies that shouldn't be bundled
  external: [
    "@opulus/core",
    "express",
    "better-auth",
    "cookie-parser",
    "cors",
    "dotenv",
    "zod",
    "node:crypto", // Keep crypto external (not bundled)
  ],
});
