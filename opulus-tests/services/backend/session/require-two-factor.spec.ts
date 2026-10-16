import { expect, test } from "@playwright/test";
import { SessionResponseSchema } from "@opulus/core";
import {
  expectErrorCode,
  expectMatchesSchema,
  expectStatus,
} from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import {
  createAuthedUser,
  enrollTwoFactor,
  signUp,
} from "../../../shared/fixtures/index.js";

/**
 * This file: two-factor is required of every user. A user who has signed up but
 * not confirmed an authenticator app can read their own session (which tells
 * the client to send them to set it up) and use the auth routes (to set it up),
 * and nothing else; once confirmed they are served as usual.
 */
test.describe("two-factor is required", () => {
  test("refuses a user without two-factor on the API's data routes (403, TWO_FACTOR_REQUIRED)", async ({
    request,
  }) => {
    // Arrange
    const user = await signUp(request);

    // Act + Assert: a sample of routes of each kind (read, write, aggregate).
    for (const [method, path] of [
      ["get", "/api/accounts"],
      ["get", "/api/items"],
      ["get", "/api/transactions"],
      ["get", "/api/accounts/net-worth"],
      ["post", "/api/link-tokens"],
    ] as const) {
      const res = await request[method](path, { headers: withSession(user.cookie) });
      await expectStatus(res, 403);
      await expectErrorCode(res, "TWO_FACTOR_REQUIRED");
    }
  });

  test("still lets that user read their session, which says they must set it up", async ({
    request,
  }) => {
    // Arrange
    const user = await signUp(request);

    // Act
    const res = await request.get("/api/session", { headers: withSession(user.cookie) });

    // Assert
    const body = await expectMatchesSchema(res, SessionResponseSchema);
    expect(body.data.user.twoFactorEnabled).toBe(false);
  });

  test("serves the user once two-factor is confirmed, and the session says so", async ({
    request,
  }) => {
    // Arrange
    const user = await enrollTwoFactor(request, await signUp(request));

    // Act
    const accounts = await request.get("/api/accounts", { headers: withSession(user.cookie) });
    const session = await request.get("/api/session", { headers: withSession(user.cookie) });

    // Assert
    await expectStatus(accounts, 200);
    const body = await expectMatchesSchema(session, SessionResponseSchema);
    expect(body.data.user.twoFactorEnabled).toBe(true);
  });

  test("is not satisfied by starting to set it up: the code must be confirmed", async ({
    request,
  }) => {
    // Arrange: two-factor enabled (secret issued) but never confirmed.
    const user = await signUp(request);
    await request.post("/api/auth/two-factor/enable", {
      headers: withSession(user.cookie),
      data: { password: user.password },
    });

    // Act
    const res = await request.get("/api/accounts", { headers: withSession(user.cookie) });

    // Assert
    await expectStatus(res, 403);
  });

  test("cannot be turned off: the disable route does not exist (404)", async ({ request }) => {
    // Arrange
    const user = await enrollTwoFactor(request, await signUp(request));

    // Act
    const res = await request.post("/api/auth/two-factor/disable", {
      headers: withSession(user.cookie),
      data: { password: user.password },
    });

    // Assert: switched off (see authEndpoints.ts), and the user is still served.
    await expectStatus(res, 404);
    await expectStatus(
      await request.get("/api/accounts", { headers: withSession(user.cookie) }),
      200,
    );
  });

  test("still rejects a request with no session (401, not 403)", async ({ request }) => {
    await expectStatus(await request.get("/api/accounts"), 401);
  });

  test("createAuthedUser gives a user who is served", async ({ request }) => {
    const { cookie } = await createAuthedUser(request);

    await expectStatus(
      await request.get("/api/accounts", { headers: withSession(cookie) }),
      200,
    );
  });
});
