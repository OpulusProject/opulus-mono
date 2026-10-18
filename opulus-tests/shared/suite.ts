import { fileURLToPath } from "node:url";
import { defineConfig, type PlaywrightTestConfig } from "@playwright/test";

/**
 * The Playwright config every suite shares: serial, one worker, the list
 * reporter, specs named `*.spec.ts` under the config's own directory. A suite
 * states only what is its own.
 */
export interface SuiteOptions {
  /** The Playwright project's name. */
  project: string;
  /** Per-test timeout, in milliseconds. */
  timeout: number;
  /**
   * Retries when running in CI (none locally). Default none, which is right for
   * a suite that runs against stubs: it is deterministic, so a retry only hides
   * a flaky spec. Only a suite that calls a real third party (integration) sets
   * it, for that third party's own transient failures.
   */
  ciRetries?: number;
  /**
   * The port the service under test listens on by default. Give it for a suite
   * that calls a service over HTTP: `TEST_BASE_URL` overrides it, the requests
   * go there with JSON accepted, and the test-DB client is disconnected when
   * the run ends. Leave it out for a suite that starts its own processes.
   */
  port?: number;
  /** Something to start before the run (a stub), and the URL that says it is up. */
  webServer?: PlaywrightTestConfig["webServer"];
  /** Run specs in parallel (for pure functions). Default serial, one worker. */
  parallel?: boolean;
}

export function defineSuite(options: SuiteOptions) {
  const { project, timeout, ciRetries = 0, port, webServer, parallel = false } = options;
  return defineConfig({
    testDir: ".",
    fullyParallel: parallel,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? ciRetries : 0,
    ...(parallel ? {} : { workers: 1 }),
    reporter: [["list"]],
    timeout,
    ...(port === undefined
      ? {}
      : {
          globalTeardown: fileURLToPath(new URL("./global-teardown.ts", import.meta.url)),
          use: {
            baseURL: process.env.TEST_BASE_URL ?? `http://localhost:${port}`,
            extraHTTPHeaders: { accept: "application/json" },
          },
        }),
    ...(webServer ? { webServer } : {}),
    projects: [{ name: project, testMatch: /.*\.spec\.ts$/ }],
  });
}
