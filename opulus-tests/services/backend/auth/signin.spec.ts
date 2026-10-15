import { expect, test } from "@playwright/test";
import { uniqueEmail, uniqueIp } from "../../../shared/client.js";
import {
  expectErrorCode,
  expectOk,
  expectStatus,
} from "../../../shared/assertions.js";
import {
  TEST_PASSWORD,
  createUserWithTwoFactor,
  signUp,
} from "../../../shared/fixtures/index.js";

/**
 * This file: the better-auth email sign-in endpoint.
 */
test.describe("POST /api/auth/sign-in/email", () => {
  test("authenticates a registered user and returns a session", async ({
    request,
  }) => {
    // Arrange
    const user = await signUp(request);

    // Act
    const res = await request.post("/api/auth/sign-in/email", {
      data: { email: user.email, password: user.password },
    });

    // Assert
    await expectStatus(res, 200);
    const body = await res.json();
    expect(body.user.email).toBe(user.email);
  });

  test("rejects a wrong password (401, INVALID_EMAIL_OR_PASSWORD)", async ({
    request,
  }) => {
    const user = await signUp(request);

    const res = await request.post("/api/auth/sign-in/email", {
      data: { email: user.email, password: "wrong-password" },
    });

    await expectStatus(res, 401);
    await expectErrorCode(res, "INVALID_EMAIL_OR_PASSWORD");
  });

  test("rejects an unknown account with the same shape as a wrong password (401, INVALID_EMAIL_OR_PASSWORD)", async ({
    request,
  }) => {
    const res = await request.post("/api/auth/sign-in/email", {
      data: { email: uniqueEmail(), password: TEST_PASSWORD },
    });

    await expectStatus(res, 401);
    await expectErrorCode(res, "INVALID_EMAIL_OR_PASSWORD");
  });

  test("returns a 2FA challenge instead of a session once 2FA is enabled", async ({
    request,
  }) => {
    // Arrange: a user with 2FA fully enabled.
    const user = await createUserWithTwoFactor(request);

    // Act: sign in with correct credentials.
    const res = await request.post("/api/auth/sign-in/email", {
      data: { email: user.email, password: user.password },
    });

    // Assert: no session yet — the caller is told to complete the 2FA step.
    await expectStatus(res, 200);
    const body = await res.json();
    expect(body.twoFactorRedirect).toBe(true);
  });

  test("rejects a request with no password (400)", async ({ request }) => {
    const res = await request.post("/api/auth/sign-in/email", {
      headers: { "x-forwarded-for": uniqueIp() },
      data: { email: uniqueEmail() },
    });

    await expectStatus(res, 400);
    await expectErrorCode(res, "VALIDATION_ERROR");
  });

  test("rejects a malformed email (400, INVALID_EMAIL)", async ({ request }) => {
    const res = await request.post("/api/auth/sign-in/email", {
      headers: { "x-forwarded-for": uniqueIp() },
      data: { email: "not-an-email", password: TEST_PASSWORD },
    });

    await expectStatus(res, 400);
    await expectErrorCode(res, "INVALID_EMAIL");
  });

  test("matches the email without regard to case", async ({ request }) => {
    // Arrange
    const user = await signUp(request);

    // Act
    const res = await request.post("/api/auth/sign-in/email", {
      headers: { "x-forwarded-for": uniqueIp() },
      data: { email: user.email.toUpperCase(), password: user.password },
    });

    // Assert
    await expectOk(res);
    expect((await res.json()).user.id).toBe(user.user.id);
  });
});
