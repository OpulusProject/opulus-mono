import { expect, test } from "@playwright/test";
import { exited, get, startService, type RunningService } from "../helpers/service.js";

/** Stop it the way a deploy does, so nothing is left holding the port (a kill would leave tsx's child running). */
async function stopService(service: RunningService) {
  service.child.kill("SIGTERM");
  await exited(service.child);
}

const PORT = 18295;

/**
 * This file: the backend outside production, where it starts with a small
 * configuration (the refusals in production are in deployment/config). It
 * starts a backend of its own.
 *
 * Test cases:
 * - with a CLIENT_URL that is not a URL it starts, and falls back to the default cookie domain
 */
test.describe("backend configuration outside production", () => {
  let backend: RunningService;
  test.afterEach(() => stopService(backend));

  test("with a CLIENT_URL that is not a URL it starts, and falls back to the default cookie domain", async () => {
    // Act
    backend = await startService({ workspace: "opulus-backend", port: PORT, portVariable: "PORT", env: { CLIENT_URL: "not a url" } });

    // Assert
    expect((await get(PORT, "/health")).status).toBe(200);
    expect(backend.child.exitCode).toBeNull();
  });
});
