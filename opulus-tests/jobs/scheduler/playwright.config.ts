import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the @opulus/scheduler jobs suite.
 *
 *   TEST_BASE_URL=http://localhost:8082 SCHEDULER_ADMIN_TOKEN=... \
 *     pnpm --filter @opulus/tests test:jobs-scheduler
 *
 * Each spec runs a scheduled job through the scheduler's jobs API (run now,
 * then follow the run) and checks what the job stored in the ISOLATED test
 * database (TEST_DATABASE_URL), which is how a job's work can be seen.
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

  projects: [{ name: "jobs", testMatch: /.*\.spec\.ts$/ }],
});
