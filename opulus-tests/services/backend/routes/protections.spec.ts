import { expect, test } from "@playwright/test";
import { expectErrorCode, expectOk, expectStatus } from "../../../shared/assertions.js";
import { anonymousContext, withSession } from "../../../shared/client.js";
import { createAuthedUser, signUp } from "../../../shared/fixtures/index.js";

/**
 * This file: the API is closed unless a route is opened on purpose. The guard
 * (requireApiSession) sits in front of the whole /api router, so these checks
 * use a path that has no route behind it: if a request to it is refused before
 * routing, so is a request to any route that is not on the guard's short list.
 * What is particular to one endpoint (its validation, its data) is in that
 * endpoint's spec, not repeated here.
 */
test.describe("the API is closed unless a route is opened on purpose", () => {
  test("refuses a request with no session (401), even for a path with no route", async ({ playwright }) => {
    // Arrange
    const anonymous = await anonymousContext(playwright);

    // Act
    const res = await anonymous.get("/api/not-a-route");
    await anonymous.dispose();

    // Assert
    await expectStatus(res, 401);
  });

  test("refuses a cookie that is not a session (401)", async ({ request }) => {
    const res = await request.get("/api/not-a-route", {
      headers: withSession("opulus.session_token=not-a-real-token"),
    });

    await expectStatus(res, 401);
  });

  test("refuses a user who has not set up two-factor (403, TWO_FACTOR_REQUIRED) on every path but their session", async ({ request }) => {
    // Arrange: signed up, but no authenticator app yet.
    const user = await signUp(request);

    // Act
    const unknown = await request.get("/api/not-a-route", { headers: withSession(user.cookie) });
    const data = await request.get("/api/accounts", { headers: withSession(user.cookie) });

    // Assert
    for (const res of [unknown, data]) {
      await expectStatus(res, 403);
      await expectErrorCode(res, "TWO_FACTOR_REQUIRED");
    }
  });

  test("still serves a user who has not set up two-factor their own session, which tells the client to set it up", async ({ request }) => {
    const user = await signUp(request);

    const res = await request.get("/api/session", { headers: withSession(user.cookie) });

    await expectOk(res);
  });

  test("answers 404 to a signed-in user for a path with no route", async ({ request }) => {
    const user = await createAuthedUser(request);

    const res = await request.get("/api/not-a-route", { headers: withSession(user.cookie) });

    await expectStatus(res, 404);
  });

  test("leaves the health check open", async ({ playwright }) => {
    const anonymous = await anonymousContext(playwright);

    const res = await anonymous.get("/api/healthcheck");
    await expectOk(res);
    const body = await res.json();
    await anonymous.dispose();

    expect(body.status).toBe("OK");
  });
});
