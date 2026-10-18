import { defineSuite } from "../../shared/suite.js";

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

export default defineSuite({
  project: "api",
  timeout: 60_000,
  port: 8082,
  webServer: {
    command: "node stub/frankfurter.mjs",
    url: `${process.env.STUB_URL ?? "http://localhost:4545"}/health`,
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
