import { expect, test } from "@playwright/test";
import { withSession } from "../../../shared/client.js";
import { expectOk, expectStatus } from "../../../shared/assertions.js";
import { createAuthedUser } from "../../../shared/fixtures/index.js";

/**
 * This file: the current-session endpoint.
 */
test.describe("GET /api/session", () => {
  test("rejects a request with no session (401)", async ({ request }) => {
    const res = await request.get("/api/session");
    await expectStatus(res, 401);
  });

  test("rejects a request with a garbage session cookie (401)", async ({
    request,
  }) => {
    const res = await request.get("/api/session", {
      headers: withSession("opulus.session_token=not-a-real-token"),
    });
    await expectStatus(res, 401);
  });

  test("returns only the documented user and session fields", async ({
    request,
  }) => {
    // Arrange
    const { cookie } = await createAuthedUser(request);

    // Act
    const res = await request.get("/api/session", {
      headers: withSession(cookie),
    });

    // Assert: the auth library knows more about the user than the client needs.
    await expectOk(res);
    const { user, session } = (await res.json()).data;
    expect(Object.keys(user).sort()).toEqual(
      ["email", "emailVerified", "id", "image", "name"].sort(),
    );
    expect(Object.keys(session).sort()).toEqual(["expiresAt", "id"]);
    expect(new Date(session.expiresAt).toISOString()).toBe(session.expiresAt);
  });

  test("returns the authenticated user for a valid session", async ({
    request,
  }) => {
    // Arrange
    const { cookie, userId, email } = await createAuthedUser(request);

    // Act
    const res = await request.get("/api/session", {
      headers: withSession(cookie),
    });

    // Assert
    await expectOk(res);
    const body = await res.json();
    expect(body.data.user).toMatchObject({ id: userId, email });
    expect(body.data.session.id).toBeTruthy();
  });
});
