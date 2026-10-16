import { expect, test } from "@playwright/test";
import { uniqueIp, withSession } from "../../../shared/client.js";
import { expectOk, expectStatus } from "../../../shared/assertions.js";
import { createAuthedUser, signIn } from "../../../shared/fixtures/index.js";

/**
 * This file: the better-auth sign-out endpoint, which the frontend calls
 * (`authClient.signOut`). Whether a session still works is read the way the
 * client reads it, from GET /api/session.
 */
test.describe("POST /api/auth/sign-out", () => {
  test("ends the session: it is refused afterwards (401)", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);
    await expectOk(
      await request.get("/api/session", { headers: withSession(cookie) }),
    );

    // Act
    const res = await request.post("/api/auth/sign-out", {
      headers: withSession(cookie),
      data: {},
    });

    // Assert
    await expectOk(res);
    expect((await res.json()).success).toBe(true);
    await expectStatus(
      await request.get("/api/session", { headers: withSession(cookie) }),
      401,
    );
  });

  test("ends only this session, not the user's others", async ({ request }) => {
    // Arrange: one user signed in on two devices.
    const user = await createAuthedUser(request);
    const other = await signIn(request, user.email);

    // Act: sign out on the first.
    await expectOk(
      await request.post("/api/auth/sign-out", {
        headers: withSession(user.cookie),
        data: {},
      }),
    );

    // Assert
    await expectStatus(
      await request.get("/api/session", { headers: withSession(user.cookie) }),
      401,
    );
    await expectOk(
      await request.get("/api/session", { headers: withSession(other.cookie) }),
    );
  });

  test("answers 200 without a session: there is nothing to end", async ({
    request,
  }) => {
    // Act
    const res = await request.post("/api/auth/sign-out", {
      headers: { "x-forwarded-for": uniqueIp() },
      data: {},
    });

    // Assert
    await expectOk(res);
  });
});
