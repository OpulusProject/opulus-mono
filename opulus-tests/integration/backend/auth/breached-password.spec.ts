import { expect, test } from "@playwright/test";
import { expectErrorCode, expectStatus } from "../../../shared/assertions.js";
import { uniqueEmail, uniqueIp, withSession } from "../../../shared/client.js";
import { signIn, signUp } from "../../../shared/fixtures/index.js";

/** A password that is in every breach list. */
const BREACHED_PASSWORD = "password123";

/** A password nobody has used: random, so it is in no breach list. */
const strongPassword = () =>
  `Strong-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;

/**
 * This file: the breached-password check at sign-up and on a password change.
 * It asks the real Have I Been Pwned service (only the first five characters
 * of the password's SHA-1 leave the server), so it is an integration spec: the
 * service suite makes no third-party calls and runs with the check off.
 */
test.describe("breached passwords", () => {
  test("rejects a breached password at sign-up (400, PASSWORD_COMPROMISED)", async ({
    request,
  }) => {
    // Act
    const res = await request.post("/api/auth/sign-up/email", {
      headers: { "x-forwarded-for": uniqueIp() },
      data: { email: uniqueEmail(), password: BREACHED_PASSWORD, name: "Pwned" },
    });

    // Assert
    await expectStatus(res, 400);
    await expectErrorCode(res, "PASSWORD_COMPROMISED");
  });

  test("accepts a password that is in no breach", async ({ request }) => {
    // Act + Assert: signUp() fails the test unless the sign-up succeeds.
    const user = await signUp(request, { password: strongPassword() });

    expect(user.user.id).toBeTruthy();
  });

  test("rejects changing to a breached password, and keeps the old one", async ({
    request,
  }) => {
    // Arrange
    const password = strongPassword();
    const user = await signUp(request, { password });

    // Act
    const res = await request.post("/api/auth/change-password", {
      headers: withSession(user.cookie),
      data: { currentPassword: password, newPassword: BREACHED_PASSWORD },
    });

    // Assert: refused, and signing in with the old password still works.
    await expectStatus(res, 400);
    await expectErrorCode(res, "PASSWORD_COMPROMISED");
    const session = await signIn(request, user.email, password);
    expect(session.user.id).toBe(user.user.id);
  });
});
