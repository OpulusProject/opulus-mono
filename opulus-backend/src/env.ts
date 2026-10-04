/**
 * Env loader (single-source-of-truth, monorepo-aware).
 *
 * Loads the nearest `.env` by walking up from the current working directory
 * until one is found or the filesystem root is reached. Keep a single
 * `.env` at the monorepo root for local development; every service will
 * find it regardless of where `pnpm --filter ...` is invoked from.
 *
 * In production (NODE_ENV=production), file loading is skipped entirely —
 * env comes from the platform (Railway Shared Variables + per-service
 * variables). Existing `process.env` is never overridden, so platform values
 * always win even in dev.
 *
 * Import this at the very top of entrypoints, before any other module that
 * reads `process.env`.
 */
import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

if (process.env.NODE_ENV !== "production") {
  let dir = process.cwd();
  // Stop at filesystem root. Also stop at `/` without entering an infinite loop.
  while (true) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) {
      loadEnv({ path: candidate });
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}
