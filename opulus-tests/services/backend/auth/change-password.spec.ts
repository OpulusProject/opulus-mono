import { expect, test } from "@playwright/test";
import { expectStatus } from "../../../shared/assertions.js";
import { withSession } from "../../../shared/client.js";
import { signIn, signUp } from "../../../shared/fixtures/index.js";

const NEW_PASSWORD = "a-brand-new-password-1";

/**
 * This file: POST /api/auth/change-password, which signs every other device out
 * (auth.ts turns Better Auth's opt-in `revokeOtherSessions` on for every call).
 */
test.describe("POST /api/auth/change-password", () => {
  test("changes the password: the old one stops working, the new one works", async ({
    request,
  }) => {
    // Arrange
    const user = await signUp(request);

    // Act
    const res = await request.post("/api/auth/change-password", {
      headers: withSession(user.cookie),
      data: { currentPassword: user.password, newPassword: NEW_PASSWORD },
    });

    // Assert
    await expectStatus(res, 200);
    await expect(signIn(request, user.email, user.password)).rejects.toThrow();
    const session = await signIn(request, user.email, NEW_PASSWORD);
    expect(session.user.id).toBe(user.user.id);
  });

  test("signs the user's other sessions out, without being asked to", async ({
    request,
  }) => {
    // Arrange: the same user on two devices.
    const user = await signUp(request);
    const otherDevice = await signIn(request, user.email, user.password);

    // Act: the password is changed from the first device, with no
    // revokeOtherSessions in the body.
    await expectStatus(
      await request.post("/api/auth/change-password", {
        headers: withSession(user.cookie),
        data: { currentPassword: user.password, newPassword: NEW_PASSWORD },
      }),
      200,
    );

    // Assert: the other device is signed out.
    await expectStatus(
      await request.get("/api/session", {
        headers: withSession(otherDevice.cookie),
      }),
      401,
    );
  });

  test("rejects a wrong current password (400) and signs nobody out", async ({
    request,
  }) => {
    // Arrange
    const user = await signUp(request);
    const otherDevice = await signIn(request, user.email, user.password);

    // Act
    const res = await request.post("/api/auth/change-password", {
      headers: withSession(user.cookie),
      data: { currentPassword: "not-the-password", newPassword: NEW_PASSWORD },
    });

    // Assert
    await expectStatus(res, 400);
    await expectStatus(
      await request.get("/api/session", {
        headers: withSession(otherDevice.cookie),
      }),
      200,
    );
  });

  test("requires authentication (401)", async ({ request }) => {
    const res = await request.post("/api/auth/change-password", {
      data: { currentPassword: "x", newPassword: NEW_PASSWORD },
    });

    await expectStatus(res, 401);
  });
});
