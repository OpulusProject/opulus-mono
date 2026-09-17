import { expect, test } from "@playwright/test";
import { uniqueEmail } from "../helpers/client.js";
import { expectStatus } from "../helpers/assertions.js";
import {
  TEST_PASSWORD,
  createUserWithTwoFactor,
  signUp,
} from "../helpers/fixtures/index.js";

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

  test("rejects a wrong password (401)", async ({ request }) => {
    const user = await signUp(request);

    const res = await request.post("/api/auth/sign-in/email", {
      data: { email: user.email, password: "wrong-password" },
    });

    await expectStatus(res, 401);
  });

  test("rejects an unknown account (401)", async ({ request }) => {
    const res = await request.post("/api/auth/sign-in/email", {
      data: { email: uniqueEmail(), password: TEST_PASSWORD },
    });

    await expectStatus(res, 401);
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
});
