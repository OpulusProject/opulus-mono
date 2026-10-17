import { defineSuite } from "../../shared/suite.js";

/**
 * Playwright config for the DOCKER IMAGE deployment suite.
 *
 *   pnpm --filter @opulus/tests test:deployment-images
 *
 * Builds each service's image from its Dockerfile, as a platform does, and runs
 * it. Needs a Docker daemon, a Postgres with its port published on the host
 * (DATABASE_URL, and migrations are applied by the image itself) and a Redis
 * (REDIS_HOST, REDIS_PORT). The containers reach those through
 * host.docker.internal, so "localhost" in DATABASE_URL and REDIS_HOST is
 * rewritten to it.
 *
 * Slow (a build per service, several minutes cold), so it is a suite of its
 * own. Serial: it builds and runs one image at a time.
 */

export default defineSuite({
  project: "images",
  timeout: 120_000,
});
