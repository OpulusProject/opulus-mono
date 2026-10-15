import { expect, test } from "@playwright/test";
import { uniqueIp, withSession } from "../../../shared/client.js";
import { expectOk } from "../../../shared/assertions.js";
import { createAuthedUser } from "../../../shared/fixtures/index.js";

/**
 * This file: better-auth's own session read, which the frontend uses
 * (`authClient.getSession`, `useSession`). Our `GET /api/session` (see
 * session/get.spec.ts) is what the data routes use; this is the one the
 * browser's auth client asks.
 */
test.describe("GET /api/auth/get-session", () => {
  test("returns the user and session for a valid session cookie", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId, email } = await createAuthedUser(request);

    // Act
    const res = await request.get("/api/auth/get-session", {
      headers: withSession(cookie),
    });

    // Assert
    await expectOk(res);
    const body = await res.json();
    expect(body.user).toMatchObject({ id: userId, email });
    expect(body.session.userId).toBe(userId);
  });

  test("answers with no session (null), not an error, when there is none", async ({
    request,
  }) => {
    // Act
    const res = await request.get("/api/auth/get-session", {
      headers: { "x-forwarded-for": uniqueIp() },
    });

    // Assert
    await expectOk(res);
    expect(await res.json()).toBeNull();
  });

  test("answers with no session (null) for a cookie that is not a session", async ({
    request,
  }) => {
    // Act
    const res = await request.get("/api/auth/get-session", {
      headers: withSession("opulus.session_token=not-a-real-token"),
    });

    // Assert
    await expectOk(res);
    expect(await res.json()).toBeNull();
  });
});
