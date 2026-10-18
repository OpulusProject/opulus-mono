import { expect, test, type APIRequestContext } from "@playwright/test";
import { expectStatus } from "../../../shared/assertions.js";
import { uniqueIp } from "../../../shared/client.js";
import { postWebhookWithoutSignature } from "../helpers/fixtures/index.js";

/** How many webhooks one IP address may post a minute (the receiver's default). */
const LIMIT = 120;

/**
 * An address of its own for a test. The receiver sits behind a proxy and counts
 * the address the proxy forwards (X-Forwarded-For), so a test picks one the
 * other specs do not use and its counter starts empty. (A random pick of 250 could
 * meet an earlier one, whose counter is not empty for a minute.)
 */
function fromAddress(request: APIRequestContext) {
  const address = uniqueIp();
  const post = () =>
    request.post("/webhook/plaid", {
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": address,
      },
      data: { webhook_type: "TRANSACTIONS", webhook_code: "x" },
    });
  return { address, post };
}

/**
 * This file: rate limiting on the public webhook route. The requests carry no
 * signature, so each is rejected (401) after it is counted: the limiter runs
 * before the signature check, which is the point (a signature check fetches
 * Plaid's key).
 */
test.describe("webhook rate limiting", () => {
  test("answers 429 once an address is over the limit", async ({ request }) => {
    // Arrange
    const { post } = fromAddress(request);

    // Act: up to the limit every request reaches the signature check...
    for (let i = 0; i < LIMIT; i++) {
      await expectStatus(await post(), 401);
    }
    const limited = await post();

    // Assert: ...then it is told to wait.
    await expectStatus(limited, 429);
    expect(await limited.json()).toMatchObject({
      error: "Too many requests",
      code: "RATE_LIMITED",
    });
    expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
  });

  test("counts each address on its own", async ({ request }) => {
    // Arrange: one address uses up its limit.
    const busy = fromAddress(request);
    for (let i = 0; i <= LIMIT; i++) await busy.post();

    // Act: another address is not affected.
    const other = fromAddress(request);
    const res = await other.post();

    // Assert
    await expectStatus(res, 401);
  });

  test("does not limit the health checks", async ({ request }) => {
    for (let i = 0; i < 5; i++) {
      await expectStatus(await request.get("/health"), 200);
    }
  });

  test("still rejects an unsigned webhook below the limit (401)", async ({
    request,
  }) => {
    const res = await postWebhookWithoutSignature(request);

    await expectStatus(res, 401);
  });
});
