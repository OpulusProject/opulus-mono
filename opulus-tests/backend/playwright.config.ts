import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the @opulus/backend REST regression suite.
 *
 *   TEST_BASE_URL=http://localhost:8080 pnpm --filter @opulus/tests test:backend
 *
 * The backend service is a black box — start it however the repo already does
 * (`pnpm dev:backend`, `node dist/server.js`, a container, or a deployed
 * instance) and point TEST_BASE_URL at it. This config knows nothing about the
 * database, better-auth, or Plaid.
 *
 * Tests run serially (workers: 1) so ordering is deterministic even though the
 * service shares a single Postgres instance across cases. Isolation comes from
 * uniqueId()-namespaced accounts, not from resetting the database.
 */
const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      accept: "application/json",
    },
  },

  projects: [{ name: "api", testMatch: /.*\.spec\.ts$/ }],
});

export { BASE_URL };
