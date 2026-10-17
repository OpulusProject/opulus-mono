import { defineSuite } from "../../shared/suite.js";

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

export default defineSuite({
  project: "deployment",
  timeout: 60_000,
  ciRetries: 1,
});
