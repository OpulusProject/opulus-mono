import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the @opulus/backend INTEGRATION suite.
 *
 *   TEST_BASE_URL=http://localhost:8080 \
 *   PLAID_SANDBOX_CLIENT_ID=... PLAID_SANDBOX_SECRET=... \
 *   pnpm --filter @opulus/tests test:backend-integration
 *
 * Unlike the service suite (opulus-tests/backend/), these specs round-trip
 * through the real Plaid Sandbox API: /sandbox/public_token/create, the
 * backend's own Plaid-proxying endpoints, and (for refresh/update-accounts)
 * end-to-end flows that depend on a persisted sandbox access_token.
 *
 * Tests self-skip when PLAID_SANDBOX_CLIENT_ID / PLAID_SANDBOX_SECRET are not
 * set — so this config is safe to run in CI without secrets (nothing fails,
 * everything is reported as skipped) and lights up on PRs where the secrets
 * are injected.
 *
 * Each spec seeds its own fresh sandbox item (no shared beforeAll fixture) so a
 * single failure is debuggable without reconstructing shared state. That makes
 * the suite slower; we accept it for isolation.
 *
 * Shared helpers (auth, client, db, assertions, generic fixtures) live in
 * opulus-tests/shared/ and are imported with relative paths. Sandbox-specific
 * helpers live beside this config in ./helpers/.
 */
const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Plaid Sandbox occasionally returns transient 5xx; a single retry absorbs
  // that without masking real backend regressions.
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"]],
  // Sandbox round-trips (public_token → exchange → accounts/get) can take
  // several seconds; give specs headroom beyond the 30s service default.
  timeout: 60_000,
  globalTeardown: "./global-teardown.ts",

  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      accept: "application/json",
    },
  },

  projects: [{ name: "integration", testMatch: /.*\.spec\.ts$/ }],
});

export { BASE_URL };
