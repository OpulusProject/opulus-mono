import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the @opulus/webhooks DEPLOYMENT suite.
 *
 *   pnpm --filter @opulus/tests test:deployment-webhooks
 *
 * See ../backend/playwright.config.ts: each spec starts its own copy of the
 * service on a port of its own and stops it again. The environment needs what
 * the service needs to boot (DATABASE_URL, REDIS_HOST and REDIS_PORT, the Plaid
 * variables) and a migrated database.
 */
export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,

  projects: [{ name: "deployment", testMatch: /.*\.spec\.ts$/ }],
});
