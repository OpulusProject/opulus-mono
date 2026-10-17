import { defineSuite } from "../../shared/suite.js";

/**
 * Playwright config for the @opulus/webhooks black-box API suite.
 *
 *   TEST_BASE_URL=http://localhost:8081 pnpm --filter @opulus/tests test:webhooks
 *
 * The webhooks receiver is a black box — start it however the repo already does
 * (`pnpm dev:webhooks`, `node dist/server.js`, a container) with Postgres and
 * Redis available, and point TEST_BASE_URL at it. Verification is over HTTP only.
 */

export default defineSuite({
  project: "api",
  timeout: 30_000,
  ciRetries: 2,
  port: 8081,
});
