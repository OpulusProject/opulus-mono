import { expect, test } from "@playwright/test";
import { extractSessionCookie, uniqueEmail, withSession } from "../../../shared/client.js";
import {
  expectErrorCode,
  expectOk,
  expectStatus,
} from "../../../shared/assertions.js";
import { TEST_PASSWORD, signUp } from "../../../shared/fixtures/index.js";

/**
 * This file: the better-auth email sign-up endpoint.
 */
test.describe("POST /api/auth/sign-up/email", () => {
  test("creates an account and issues a session a follow-up read accepts", async ({
    request,
  }) => {
    // Arrange
    const email = uniqueEmail();

    // Act
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email, password: TEST_PASSWORD, name: "Ada Lovelace" },
    });

    // Assert: status + body, then the session side effect via an API read.
    await expectOk(res);
    const body = await res.json();
    expect(body.user).toMatchObject({ email, name: "Ada Lovelace" });
    expect(body.user.id).toBeTruthy();

    const session = await request.get("/api/session", {
      headers: withSession(extractSessionCookie(res)),
    });
    await expectOk(session);
    expect((await session.json()).data.user.email).toBe(email);
  });

  test("rejects a malformed email (400, INVALID_EMAIL)", async ({ request }) => {
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email: "not-an-email", password: TEST_PASSWORD, name: "Nope" },
    });

    await expectStatus(res, 400);
    await expectErrorCode(res, "INVALID_EMAIL");
  });

  test("rejects a password below the minimum length (400, PASSWORD_TOO_SHORT)", async ({
    request,
  }) => {
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email: uniqueEmail(), password: "x", name: "Shorty" },
    });

    await expectStatus(res, 400);
    await expectErrorCode(res, "PASSWORD_TOO_SHORT");
  });

  test("rejects a duplicate email (422, USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL)", async ({
    request,
  }) => {
    const existing = await signUp(request);

    const res = await request.post("/api/auth/sign-up/email", {
      data: { email: existing.email, password: TEST_PASSWORD, name: "Twin" },
    });

    await expectStatus(res, 422);
    await expectErrorCode(res, "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL");
  });
});
