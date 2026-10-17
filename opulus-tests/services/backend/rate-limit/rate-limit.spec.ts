import { expect, test, type APIRequestContext } from "@playwright/test";
import { withSession } from "../../../shared/client.js";
import {
  expectStatus,
  expectValidationError,
} from "../../../shared/assertions.js";
import { createAuthedUser } from "../../../shared/fixtures/index.js";

/** How many requests a user may make a minute to the routes that call Plaid. */
const PLAID_LIMIT = 10;

/**
 * A request to a Plaid route that the route's own validation rejects (400), so
 * it is counted by the limiter but never reaches Plaid.
 */
function badItemRequest(request: APIRequestContext, cookie: string) {
  return request.post("/api/items", {
    headers: withSession(cookie),
    data: {},
  });
}

/**
 * This file: request rate limiting. The per-user limiter on the routes that call
 * Plaid is what is exercised, because each test has a user of its own and so a
 * counter of its own; the per-IP limiter on the whole API shares one counter
 * with every other spec, so the suite runs with its limit raised
 * (RATE_LIMIT_PER_IP) and it is built the same way.
 */
test.describe("request rate limiting", () => {
  test("answers 429 once a user is over the limit on a route that calls Plaid", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act: up to the limit every request is answered normally (here, rejected as invalid)...
    for (let i = 0; i < PLAID_LIMIT; i++) {
      await expectValidationError(await badItemRequest(request, cookie));
    }
    const limited = await badItemRequest(request, cookie);

    // Assert: ...then it is told to wait.
    await expectStatus(limited, 429);
    expect(await limited.json()).toMatchObject({
      error: "Too many requests",
      code: "RATE_LIMITED",
    });
    expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
  });

  test("says how much of the limit is left on a counted response", async ({
    request,
  }) => {
    const { cookie } = await createAuthedUser(request);

    const res = await badItemRequest(request, cookie);

    expect(res.headers()["ratelimit"]).toContain(`remaining=${PLAID_LIMIT - 1}`);
  });

  test("counts the routes that call Plaid together", async ({ request }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act: some on connecting, some on updating a link token, then creating one.
    for (let i = 0; i < 5; i++) {
      await badItemRequest(request, cookie);
      await request.post("/api/link-tokens/update", {
        headers: withSession(cookie),
        data: {},
      });
    }
    const next = await request.post("/api/link-tokens", {
      headers: withSession(cookie),
      data: {},
    });

    // Assert
    await expectStatus(next, 429);
  });

  test("counts each user on their own", async ({ request }) => {
    // Arrange: one user uses up their limit.
    const busy = await createAuthedUser(request);
    for (let i = 0; i <= PLAID_LIMIT; i++) {
      await badItemRequest(request, busy.cookie);
    }
    const other = await createAuthedUser(request);

    // Act
    const res = await badItemRequest(request, other.cookie);

    // Assert: the other user is not affected.
    await expectValidationError(res);
  });

  test("does not count a request that has no session", async ({ request }) => {
    // Arrange: more unauthenticated requests than the limit, from the same address.
    for (let i = 0; i < PLAID_LIMIT + 5; i++) {
      await expectStatus(await request.post("/api/items", { data: {} }), 401);
    }
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await badItemRequest(request, cookie);

    // Assert: a fresh user is still not limited, and the 401s were never 429s.
    await expectValidationError(res);
  });

  test("does not limit routes that do not call Plaid", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    for (let i = 0; i < PLAID_LIMIT * 3; i++) {
      const res = await request.get("/api/accounts", {
        headers: withSession(cookie),
      });
      await expectStatus(res, 200);
    }
  });
});
