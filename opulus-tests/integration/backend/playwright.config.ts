import { defineSuite } from "../../shared/suite.js";

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

export default defineSuite({
  // Plaid Sandbox occasionally returns transient 5xx; a single retry absorbs
  // that without masking real backend regressions. Sandbox round-trips
  // (public_token → exchange → accounts/get) can take several seconds.
  project: "integration",
  timeout: 60_000,
  ciRetries: 2,
  port: 8080,
});
