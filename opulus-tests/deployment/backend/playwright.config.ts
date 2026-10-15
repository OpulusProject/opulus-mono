import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the @opulus/backend DEPLOYMENT suite.
 *
 *   pnpm --filter @opulus/tests test:deployment-backend
 *
 * The service and integration suites point at a backend that is already
 * running and talk to it over HTTP. These specs are about the PROCESS: how it
 * behaves when a platform starts, signals and stops it. So each spec starts
 * its own backend (on a port of its own, so it never meets the other suites'
 * server) and stops it again. Nothing is started for you; the environment only
 * needs what the backend needs to boot (DATABASE_URL, BETTER_AUTH_SECRET,
 * CLIENT_URL, the Plaid variables) and a migrated database.
 *
 * Serial, since each spec owns a process and a port.
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
