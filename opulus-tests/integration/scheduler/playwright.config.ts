import { defineSuite } from "../../shared/suite.js";

/**
 * Playwright config for the @opulus/scheduler INTEGRATION suite.
 *
 *   TEST_BASE_URL=http://localhost:8082 SCHEDULER_ADMIN_TOKEN=... \
 *     pnpm --filter @opulus/tests test:integration-scheduler
 *
 * The one thing the service suite (opulus-tests/services/scheduler) cannot
 * prove is that the REAL provider still answers the way our gateway expects,
 * so these specs run a job against the real Frankfurter API. The scheduler
 * must be started WITHOUT FRANKFURTER_BASE_URL (the default is the public API),
 * with SCHEDULER_RUN_ON_START=false so a start-up run does not race the specs.
 *
 * No credentials are needed, only network access. The specs assert evidence
 * (rows for a recent weekday, the euro at 1, a plausible USD rate), never
 * exact rates, which change every day.
 *
 * Serial, for the same reason as the service suite: exchange_rate is shared.
 */

export default defineSuite({
  // A transient provider error is retried by the job itself; one retry here
  // absorbs a slow first connection.
  project: "integration",
  timeout: 90_000,
  ciRetries: 1,
  port: 8082,
});
