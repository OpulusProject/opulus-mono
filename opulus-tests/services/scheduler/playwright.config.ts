import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the @opulus/scheduler black-box API suite.
 *
 *   TEST_BASE_URL=http://localhost:8082 SCHEDULER_ADMIN_TOKEN=... \
 *     pnpm --filter @opulus/tests test:services-scheduler
 *
 * Covers the scheduler's own behaviour with no third party: its jobs API (a
 * run is queued, followed, fails and retries) and what each job stores, run
 * through that API against a stub of its provider. A job has no response beyond
 * its result, so what it stored is read from the ISOLATED test database
 * (TEST_DATABASE_URL), the exception to "verify over HTTP" for jobs. The real
 * provider is covered by the integration suite (opulus-tests/integration/scheduler).
 *
 * The scheduler must be started pointed at the Frankfurter stub
 * (FRANKFURTER_BASE_URL=http://localhost:4545/v1), with SCHEDULER_RUN_ON_START=false
 * so a start-up run does not race the specs. The stub is started here if it
 * is not already running (CI starts it first, before the scheduler).
 *
 * Serial: the jobs share one table (exchange_rate is not per user), so each
 * spec clears it and they must not overlap.
 */
const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:8082";
const STUB_URL = process.env.STUB_URL ?? "http://localhost:4545";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 60_000,
  globalTeardown: "./global-teardown.ts",

  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: { accept: "application/json" },
  },

  webServer: {
    command: "node stub/frankfurter.mjs",
    url: `${STUB_URL}/health`,
    reuseExistingServer: true,
    timeout: 10_000,
  },

  projects: [{ name: "api", testMatch: /.*\.spec\.ts$/ }],
});
