import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the @opulus/backend black-box API suite.
 *
 *   TEST_BASE_URL=http://localhost:8080 pnpm --filter @opulus/tests test:backend
 *
 * The backend service is a black box — start it however the repo already does
 * (`pnpm dev:backend`, `node dist/server.js`, a container, or a deployed
 * instance) and point TEST_BASE_URL at it. Verification is always over HTTP.
 *
 * A few specs seed resources that have no create endpoint (items / transactions)
 * directly into an ISOLATED test database via helpers/db.ts, which requires
 * TEST_DATABASE_URL to be set to that same store. Everything else is pure HTTP.
 *
 * Tests run serially (workers: 1) so ordering is deterministic even though the
 * service shares one Postgres instance across cases; isolation comes from
 * uniqueId()-namespaced data, not resets.
 */
const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,
  globalTeardown: "./global-teardown.ts",

  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      accept: "application/json",
    },
  },

  projects: [{ name: "api", testMatch: /.*\.spec\.ts$/ }],
});

export { BASE_URL };
