import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the CONFIGURATION deployment suite.
 *
 *   pnpm --filter @opulus/tests test:deployment-config
 *
 * What each service needs in its environment to start in production. Needs no
 * database or Redis: a service with a bad configuration stops before it
 * connects to anything. The specs start each service with an empty environment
 * of its own, so nothing needs to be set.
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
