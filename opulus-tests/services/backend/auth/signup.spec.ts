import { expect, test } from "@playwright/test";
import {
  extractSessionCookie,
  uniqueEmail,
  uniqueIp,
  withSession,
} from "../../../shared/client.js";
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

  test("rejects a malformed email (400, VALIDATION_ERROR)", async ({ request }) => {
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email: "not-an-email", password: TEST_PASSWORD, name: "Nope" },
    });

    await expectStatus(res, 400);
    await expectErrorCode(res, "VALIDATION_ERROR");
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
    // Arrange: an account that already exists.
    const existing = await signUp(request);

    // Act
    const res = await request.post("/api/auth/sign-up/email", {
      data: { email: existing.email, password: TEST_PASSWORD, name: "Twin" },
    });

    // Assert
    await expectStatus(res, 422);
    await expectErrorCode(res, "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL");
  });

  test("rejects a request with no name (400)", async ({ request }) => {
    const res = await request.post("/api/auth/sign-up/email", {
      headers: { "x-forwarded-for": uniqueIp() },
      data: { email: uniqueEmail(), password: TEST_PASSWORD },
    });

    await expectStatus(res, 400);
    await expectErrorCode(res, "VALIDATION_ERROR");
  });

  test("rejects a request with no password (400)", async ({ request }) => {
    const res = await request.post("/api/auth/sign-up/email", {
      headers: { "x-forwarded-for": uniqueIp() },
      data: { email: uniqueEmail(), name: "No Password" },
    });

    await expectStatus(res, 400);
    await expectErrorCode(res, "VALIDATION_ERROR");
  });

  test("rejects a password above the maximum length (400, PASSWORD_TOO_LONG)", async ({
    request,
  }) => {
    const res = await request.post("/api/auth/sign-up/email", {
      headers: { "x-forwarded-for": uniqueIp() },
      data: { email: uniqueEmail(), password: "a".repeat(200), name: "Too Long" },
    });

    await expectStatus(res, 400);
    await expectErrorCode(res, "PASSWORD_TOO_LONG");
  });

  test("treats an email's case as the same address (422, USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL)", async ({
    request,
  }) => {
    // Arrange
    const email = uniqueEmail();
    await signUp(request, { email });

    // Act: the same address in capitals.
    const res = await request.post("/api/auth/sign-up/email", {
      headers: { "x-forwarded-for": uniqueIp() },
      data: { email: email.toUpperCase(), password: TEST_PASSWORD, name: "Shouting" },
    });

    // Assert
    await expectStatus(res, 422);
    await expectErrorCode(res, "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL");
  });
});
