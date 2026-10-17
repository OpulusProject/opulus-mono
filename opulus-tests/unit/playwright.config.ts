import { defineSuite } from "../shared/suite.js";

/**
 * Playwright config for the @opulus/core unit specs.
 *
 *   pnpm --filter @opulus/tests test:unit-core
 *
 * The only suite that is not black-box over HTTP. It covers pure functions in
 * core that no endpoint can observe (today: the access-token crypto), needs no
 * service, database or network, and runs in a second.
 */

export default defineSuite({
  project: "unit",
  timeout: 10_000,
  parallel: true,
});
