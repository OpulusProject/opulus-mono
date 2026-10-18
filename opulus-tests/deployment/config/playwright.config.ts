import { defineSuite } from "../../shared/suite.js";

/**
 * Playwright config for the CONFIGURATION deployment suite.
 *
 *   pnpm --filter @opulus/tests test:deployment-config
 *
 * What each service needs in its environment to start in production. Needs no
 * database or Redis: a service with a bad configuration stops before it
 * connects to anything. The specs start each service with an empty environment
 * of its own, so nothing needs to be set.
 */

export default defineSuite({
  project: "deployment",
  timeout: 60_000,
});
