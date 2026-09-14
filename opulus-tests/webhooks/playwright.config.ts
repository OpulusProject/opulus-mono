import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the @opulus/webhooks REST regression suite.
 *
 *   TEST_BASE_URL=http://localhost:8081 pnpm --filter @opulus/tests test:webhooks
 *
 * The webhooks receiver is a black box — start it however the repo already does
 * (`pnpm dev:webhooks`, `node dist/server.js`, a container) with Postgres and
 * Redis available, and point TEST_BASE_URL at it. This config knows nothing
 * about the queue, Redis, or Plaid signing internals.
 */
const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:8081";

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
