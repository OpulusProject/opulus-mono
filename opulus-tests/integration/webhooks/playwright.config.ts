import { defineSuite } from "../../shared/suite.js";

/**
 * Playwright config for the webhook RECEIVER end-to-end suite.
 *
 *   WEBHOOK_PUBLIC_URL=https://<tunnel>  TEST_BASE_URL=http://localhost:8080 \
 *   TEST_DATABASE_URL=... PLAID_SANDBOX_CLIENT_ID=... PLAID_SANDBOX_SECRET=... \
 *   pnpm --filter @opulus/tests test:integration-webhooks
 *
 * Unlike the service suite (which can only prove the receiver REJECTS bad
 * requests, because Plaid signs genuine ones), these specs make Plaid itself
 * deliver the webhooks: they link a sandbox item whose webhook URL is the
 * receiver, ask Plaid's sandbox to fire a webhook (/sandbox/item/fire_webhook,
 * /sandbox/item/reset_login), and then wait for the effect to show up. That
 * exercises the real path: Plaid's signed request, JWT verification, the
 * queue and worker, the handler, and the database.
 *
 * Needed running, all on the same database (TEST_DATABASE_URL):
 *   - the backend (TEST_BASE_URL), used to link the item and read it back
 *   - the webhooks receiver, with Redis, reachable from the internet at
 *     WEBHOOK_PUBLIC_URL (a tunnel, e.g. `pnpm dev:webhooks:tunnel`)
 *
 * Webhooks arrive asynchronously, so specs poll rather than assert at once.
 */

export default defineSuite({
  // Delivery goes over the public internet; one retry absorbs a dropped hop.
  project: "webhooks",
  timeout: 180_000,
  ciRetries: 1,
  port: 8080,
});
