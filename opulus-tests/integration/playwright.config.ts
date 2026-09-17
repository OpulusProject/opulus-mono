import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the Plaid **integration** suite.
 *
 *   TEST_BASE_URL=http://localhost:8080 pnpm --filter @opulus/tests test:integration
 *
 * Unlike the service-api suites (which are deterministic and gate merges), these
 * tests make REAL calls out to Plaid's Sandbox environment. That means:
 *   - the backend under test must be booted with real Sandbox credentials
 *     (PLAID_CLIENT_ID / PLAID_SECRET / PLAID_ENV=sandbox);
 *   - responses depend on a live external provider, so occasional latency or 5xx
 *     is expected — hence retries, generous timeouts, and a single worker to
 *     stay well under Sandbox rate limits.
 *
 * This suite is intentionally NOT part of the merge gate (see the
 * integration workflow, which runs on a schedule / on demand).
 */
const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 2,
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      accept: "application/json",
    },
  },

  projects: [{ name: "integration", testMatch: /.*\.spec\.ts$/ }],
});

export { BASE_URL };
